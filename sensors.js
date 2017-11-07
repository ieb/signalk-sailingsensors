/*jshint node:true */
"use strict";
/*
 * Copyright 2017 Ian Boston <ianboston@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


 /*
 * measures raw wind speed and wind angle.
 */
(module.exports = function() {
  const stats = require('./stats');
  const pulsesensors = require("./pulsesensors");
  const adc = require("./adc");
  const imu = require("./IMU");


  // Conversion functions.
  function KnToMs(v) {
    return v*1852.0/3600.0;
  }
  function MsToKn(v) {
    return v*3600.0/1852.0;
  }
  function RadToDeg(v) {
    return v*180.0/Math.PI;
  }
  function DegToRad(v) {
    return v*Math.PI/180.0;
  }

  function fixAngle(d) {
    if ( d > Math.PI ) d = d - Math.PI;
    if ( d < -Math.PI) d = d + Math.PI;
    return d;
  }









   
  function Sensors(app, plugin, config) {

    this.config = config;
    this.pitch = 0;
    this.roll = 0;
    this.angleOfHeel  = 0;
    this.waterSpeed = 0;
    if (this.config.Kfactor === undefined ) {
      this.config.Kfactor = 9.0;
    }
    if (this.config.UpwashK === undefined ) {
      this.config.UpwashK = 9.0;
    }
    if (this.config.userWaterSpeedCorrection === undefined ) {
      this.config.userWaterSpeedCorrection = 1.0;
    }
    if (this.config.mastHeight === undefined ) {
      this.config.mastHeight = 19.0;
    }
    if (this.config.waterSpeedHeelCorrections === undefined ) {
      this.config.waterSpeedHeelCorrections = [
        {
          angleOfHeel: 0,
          factor: 1.0
        }
      ];
    }
    if ( this.config.windSin === undefined ) {
      this.config.windSin = {
        min: 2.0,
        max: 6.0
      };
    }
    if ( this.config.windCos === undefined ) {
      this.config.windCos = {
        min: 2.0,
        max: 6.0
      };
    }
    if (this.config.windSensorHardware === undefined ) {
      this.config.windSensorHardware = {
        pulsepin: 6,
        calibration: [
        // linear response of 1.045Hz per kn
        // conversion is 1/KnToMS so use MSToKn
          {
           frequency: 0,
           pulsesPerMeter: MsToKn(1.045)           
          }
        ],
        sinADC: 0,
        cosADC: 1
      };
    }

    if (this.config.waterSensorHardware === undefined ) {
      this.config.waterSensorHardware = {
        pulsepin: 7, // GPIO Pin
        calibration: [
        // linear response of 5.5Hz  per kn
        // conversion is 1/KnToMS so use MSToKn
          {
           frequency: 0,
           pulsesPerMeter: MsToKn(5.5)            
          }
        ]
      }
    }
    if ( this.config.ADCAddress === undefined) {
      this.config.ADCAddress = {
        buss: 'dev/i2c-1',
        address: 0x48
      }
    }
    if ( this.config.deviation === undefined) {
      this.config.deviation = 0;
    }
    if ( this.config.ouputPeriod === undefined) {
      this.config.outputPeriod = 500;
    }

    if ( this.config.windPeriod === undefined) {
      this.config.windPeriod = 100;
    }
    if ( this.config.motionPeriod === undefined) {
      this.config.motionPeriod = 100;
    }
    if ( this.config.calculationPeriod === undefined) {
      this.config.calculationPeriod = 200;
    }
    if ( this.config.windSensorNMEA2000Period === undefined) {
      this.config.windSensorNMEA2000Period = 500;
    }
    if ( this.config.waterSensorNMEA2000Period === undefined) {
      this.config.waterSensorNMEA2000Period = 500;
    }



    this.leeway = 0;
    this.aparentWind = {
      speed: 0,
      angle: 0,
      upwashAngle: 0
    };
    this.trueWind = {
      speed: 0,
      angle: 0
    };

    // setup raw wind and boat speed sensors listenting to pulses, averaging
    // over 10 pulses.
    // waterSpeed is 5.5Hz per Kn
    // windSpeed is 1.045Hz per Kn
    this.windSpeedSensor = new PulseToVelocityIIR(this.config.windSensorHardware.pulsepin, 10, this.config.windSensorHardware.calibration);
    this.waterSpeedSensor = new PulseToVelocityIIR(this.config.waterSensorHardware.pulsepin, 10, this.config.waterSensorHardware.calibration);
    

    this.rateGyro = new RateGyro();
    this.pose = new Pose();
        // register a timer to get ADC data.
    this.windAngleStats = new stats.AngleStats(10, "wind");
    this.rawSinVStats = new stats.Stats(10,"windSinV");
    this.rawCosVStats = new stats.Stats(10,"windCosV");
    var adc = new ADC(this.config.ADCAddress.address, this.config.ADCAddress.buss);

    var self = this;

    // register a timer for getting IMU data
    this.motionInterval = setInterval(function() {
      imu.read(this.pose, this.rateGyro);
    }, config.motionPeriod);



    this.windDirectionInterval = setInterval(function() {
      adc.readChannels(0, [0,1], [], function(e, data) {
        if (e) {
          console.log("B", e);
          return;
        }
        self.rawSinVStats.set(data[self.config.windSensorHardware.sinADC]);
        self.rawCosVStats.set(data[self.config.windSensorHardware.cosADC]);
        var sinV = Math.min(1.0,Math.max(0.0,(data[self.config.windSensorHardware.sinADC]-self.config.windSin.min)/(self.config.windSin.max-self.config.windSin.min)));
        var cosV = Math.min(1.0,Math.max(0.0,(data[self.config.windSensorHardware.cosADC]-self.config.windCos.min)/(self.config.windCos.max-self.config.windCos.min)));
        self.windAngleStats.setSC(sinV, cosV);
      });
      // if this is faster than the ACS can manage, secondard I2C operations will start before the existing one 
      // has finished. This will only impact concurrent operations to the same I2C address and not concurrent
      // operations on the I2C bus. For instance the IMU can be read seperately as teh 
      // I2C bus addresses each message to the device.
    }, config.windPeriod);

     // The above handlers all record information into stats that can then be inspected to gather current data.
     // This is used, in combination to produce output including apply corrections for mast motion, heel and other
     // distortions. 

    this.calulationInterval = setInterval(function() {
      // calculate wind speed direction, water speed, true, aparent, leeway etc
      // none of these methods should queue so that the calculation is baed on a snapshot of data.
      self.calcHeading();
      self.calcHeel();
      self.calcLeeway();
      self.calcUpwashAngle();
      self.applyCorrectionsToWaterSpeed();
      self.applyCorrectionsToWind();
      self.calcTrueWind();
    }, config.calculationPeriod);

    // emit SignalK data.
    this.outpuInterval = setInterval(function() {
      var delta = {
        "context": "vessels." + app.selfId,
        "updates": [
          {
            "source": {
              "src": "multi_sensor"
            },
            "timestamp": (new Date()).toISOString(),
            "values": [
                { // checked
                  "path": "sensors.timestamp",
                  "value": Date.now()
                },
                { // checked
                  "path": "sensors.wind.pulses",
                  "value": self.windSpeedSensor.npulse
                },
                { // checked
                  "path": "sensors.wind.frequency",
                  "value": self.windSpeedSensor.pulseFrequency
                },
                { // checked
                  "path": "sensors.wind.pulsesPerMeter",
                  "value": self.windSpeedSensor.pulsesPerMeter
                },
                { // checked
                  "path": "sensors.water.pulses",
                  "value": self.waterSpeedSensor.npulse
                },
                { // checked
                  "path": "sensors.water.frequency",
                  "value": self.waterSpeedSensor.pulseFrequency
                },
                { // checked
                  "path": "sensors.water.pulsesPerMeter",
                  "value": self.waterSpeedSensor.pulsesPerMeter
                },
                { // checked
                  "path": "sensors.wind.sinV",
                  "value":  self.rawSinVStats.mean()
                },
                { // checked
                  "path": "sensors.wind.cosV",
                  "value":  self.rawCosVStats.mean()
                },
                {  // checked
                  "path": "navigation.headingMagnetic",
                  "value": self.heading
                },
                { // checked
                  "path": "navigation.rateOfTurn",
                  "value": self.rateGyro.yaw.mean()
                },
                { // checked
                  "path": "navigation.attitude.roll",
                  "value": self.pose.roll.mean()
                },
                { // checked
                  "path": "navigation.attitude.pitch",
                  "value": self.pose.pitch.mean()
                },
                { // checked
                  "path": "navigation.attitude.yaw",
                  "value": self.pose.yaw.mean()
                },
                { //checked
                  "path": "environment.wind.speedApparent",
                  "value": self.aparentWind.speed
                },
                { // checked
                  "path": "environment.wind.angleApparent",
                  "value": self.aparentWind.angle
                },
                { // checked
                  "path": "environment.wind.speedTrue",
                  "value": self.trueWind.speed
                },
                { // checked
                  "path": "environment.wind.angleTrue",
                  "value": self.trueWind.angle
                },
                { // checked
                  "path": "navigation.leewayAngle",
                  "value": self.leeway
                },
                { // checked
                  "path": "navigation.speedThroughWater",
                  "value": self.waterSpeed
                },
                { // checked
                  "path": "navigation.trip.log",
                  "value": self.waterSpeedSensor.distance
                },
                { // checked
                  "path": "navigation.trip.lastReset",
                  "value": self.waterSpeedSensor.distanceReset
                }

              ]
          }
        ]
      }        
       console.log("got sensor delta: " + JSON.stringify(delta))
      app.handleMessage(plugin.id, delta);
    }, config.outputPeriod);

    // also emit sensor data back to NMEA2000 for instucments to display.
    // dont emit derived data here.
     this.windSpeedNMEA2000Interval = setInterval(function() {

     }, config.windSensorNMEA2000Period);



     this.waterSpeedNMEA2000Interval = setInterval(function() {


     }, config.waterSensorNMEA2000Period);


     // PGN 065409 transmitted in response to 126208. 065409 containing water speed pulse counts. see Airmar docs.
     // 126720-41 is an Airmar proprietary speed calibration message, this could be emitted as is the same as the 
     // calibration structure in nature.






  }

  Sensors.prototype.close = function() {
    this.windSpeedSensor.close();
    this.waterSpeedSensor.close();
    clearInterval(this.waterSpeedNMEA2000Interval);
    clearInterval(this.windSpeedNMEA2000Interval);
    clearInterval(this.outpuInterval);
    clearInterval(this.calulationInterval);
    clearInterval(this.windDirectionInterval);
    clearInterval(this.motionInterval);
  };

  Sensors.prototype.calcHeel = function() {
    // calcualte the angleOfHeel of the mast based on both pitch and roll.
    this.pitch = this.pose.pitch.mean();
    this.roll = this.pose.roll.mean();
    var pb2 = Math.PI/2, angleOfHeal = 0;
    if (Math.abs(this.pitch - pb2) < 0.001 || Math.abs(this.roll-pb2) < 0.001) {
      this.angleOfHeel = pb2;
    } else {
      var tanpitch = Math.tan(this.pitch);
      var tanroll = Math.tan(this.roll);
      this.angleOfHeel = Math.atan(Math.sqrt(tanpitch*tanpitch+tanroll*tanroll));
    }
  };


  Sensors.prototype.calcLeeway = function() {
    // using the standard formula an alternative is to use a KalmanFilter.
    // see http://robotsforroboticists.com/kalman-filtering/  and http://vm2330.sgvps.net/~syrftest/images/library/20150805142512.pdf
    // Grouprama. 
    // This comes from Pedrick see http://www.sname.org/HigherLogic/System/DownloadDocumentFile.ashx?DocumentFileKey=5d932796-f926-4262-88f4-aaca17789bb0
    // Also in that paper
    // Upwash angle in degees = UK*cos(awa)*cos(3*MstoKn(aws)*PI/180)
    // for aws < 30 and awa < 90. UK  =15 for masthead and 5 for fractional
    if (this.waterSpeed < 1E-3) {
      this.leeway = 0;
    } else {
      this.leeway = this.config.Kfactor * this.roll / (this.waterSpeed * this.waterSpeed);
    }
  };

  Sensors.prototype.calcHeading = function() {
    this.heading = this.pose.yawToHeading(this.config.deviation);
  };


  var kn30 = KnToMs(30.0);
  Sensors.prototype.calcUpwashAngle = function() {
      // This comes from Pedrick see http://www.sname.org/HigherLogic/System/DownloadDocumentFile.ashx?DocumentFileKey=5d932796-f926-4262-88f4-aaca17789bb0
      // Upwash angle in degees = UK*cos(awa)*cos(3*MstoKn(aws)*PI/180)
      // for aws < 30 and awa < 90. UK  =15 for masthead and 5 for fractional
    if (this.aparentWind.speed < kn30 && Math.abs(this.aparentWind.angle) < Math.PI/2) {
      this.aparentWind.upwashAngle = DegToRad(this.config.UpwashK*Math.cos(this.aparentWind.angle)
        *Math.cos(DegToRad(3*MsToKn(this.aparentWind.speed))));
    } else {
      this.aparentWind.upwashAngle = 0;
    }
  };


  Sensors.prototype.applyCorrectionsToWaterSpeed = function() {
    this.waterSpeedSensor.read();
    this.waterSpeed = this.waterSpeedSensor.speed;
    // wasterSpeedHeelCorrections is sorted list of heel and correction objects. Largest first.
    for (var i = 0; i < this.config.waterSpeedHeelCorrections.length; i++) {
      if ( this.angleOfHeel > this.config.waterSpeedHeelCorrections[i].angleOfHeel ) {
        this.waterSpeed = this.waterSpeed * this.config.waterSpeedHeelCorrections[i].factor;
        break;
      }
    };
  };


  Sensors.prototype.applyCorrectionsToWind = function() {

      // correct for angle of heal, this is determined by experiment. Anenomiters have a very non linear 
      // behavior. Ultrasound sensors tend to follow a much more idealised model. The idealised model
      // assumes the annenomiter follows a cosine rule. This function corrects the annenomiter reading
      // to match the cosine rule, first by correcting to the horizontal and then
      // correcting to give the masthead spped in the masthead co-ordinates.From
      // see http://www.dewi.de/dewi/fileadmin/pdf/publications/Publikations/S09_2.pdf, figure 9 A100LM-ME1 
      // which appears to be close to most marine annenomiters, abov
      this.windSpeedSensor.read();

      this.aparentWind.speed = this.windSpeedSensor.speed;

      if ( this.angleOfHeel > 0.174533) { // > 10 degress + 3%
        this.aparentWind.speed = this.aparentWind.speed*1.03;
      } else if ( this.angleOfHeel > 0.139626) { // >8 degrees +2%
        this.aparentWind.speed = this.aparentWind.speed*1.02;
      } else if ( this.angleOfHeel > 0.10472 ) { // 6 degrees +1%
        this.aparentWind.speed = this.aparentWind.speed*1.01;
      }
      // now the speed is corrected for angle of heal reative horizontal.
      // apply the cosine rule to correct for angle of heal.
      this.aparentWind.speed =  this.aparentWind.speed*Math.cos(this.angleOfHeel);


      // apply motion corrections to the windSpeed and windAngle, the mast is moving
      // so calculate the roll and pitch components of the tipVelocity, 
      // then subtract those from the roll and pich components of the wind.
      // finally convert the corrected roll and pitch components back into 
      // angle and speed.
      // there is an assumption that the yaw rate is not significant enough to change the
      // wind angle. This is probably true for low angles of heel.

      var tipVelocity = {
        roll: this.rateGyro.roll.mean()*this.config.mastHeight,
        pitch: this.rateGyro.pitch.mean()*this.config.mastHeight
      };
      var correctedWind = {
        roll: this.windAngleStats.sin.mean()*this.aparentWind.speed-tipVelocity.roll,
        pitch: this.windAngleStats.cos.mean()*this.aparentWind.speed-tipVelocity.pitch
      };
      this.aparentWind.speed = Math.sqrt(correctedWind.roll*correctedWind.roll+correctedWind.pitch*correctedWind.pitch);
      this.aparentWind.angle = Math.atan2(correctedWind.roll, correctedWind.pitch);



  };



  Sensors.prototype.calcTrueWind = function() {
      var stw_lee = this.waterSpeed*Math.cos(this.leeway);
      var awa_lee = this.aparentWind.angle;
      if ( awa_lee > 0 ) {
        awa_lee = awa_lee +  this.leeway;
      } else {
        awa_lee = awa_lee -  this.leeway;         
      }
      // this should be a noop, but just in case the leeway downwind caused something wierd.
      awa_lee = fixAngle(awa_lee);

      var ctws = Math.sqrt((stw_lee*stw_lee+this.aparentWind.speed*this.aparentWind.speed)-(2*stw_lee*this.aparentWind.speed*Math.cos(awa_lee)));
      var ctwa = 0.0;
      if ( ctws > 1.0E-3 ) {
          ctwa = (this.aparentWind.speed*Math.cos(awa_lee)-stw_lee)/ctws;
          if ( ctwa > 0.9999 || ctwa < -0.9999) {
              ctwa = 0.0;
          } else {
              ctwa = Math.acos(ctwa);
          }
      }
      if ( awa_lee < 0) {
          ctwa = -ctwa;
      }
      this.trueWind.speed = ctws;
      this.trueWind.angle = ctwa;
    }




  return {
    Sensors : Sensors
  };
}());

