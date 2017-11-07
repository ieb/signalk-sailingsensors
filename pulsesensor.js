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

(module.exports = function() {
  const stats = require('./stats');
  var wpi; 
  try {
    wpi = require('node-wiring-pi');
  } catch (e) {
    wpi = require('./fakewiring-pi');
    console.log("Loaded Fake Wiring cause:",e);
  }
  wpi.wiringPiSetupSys()
  /*try {
    // this needs root
    wpi.wiringPiSetup();
  } catch(e) {
    // try with non root.
    wpi.wiringPiSetupSys()
  }*/

  function MsToKn(v) {
    return v*3600.0/1852.0;
  }


  /**
   * Monitor pulses using an IIR filter.
   * This is probably lower cost than a moving average. 
   * velocity is claculated in m/s from the IIR filtered period.
   * distance is calculated using the number of pulses scaled by the 
   * most recent velocity. The pulse count is direct with no filter.
   * Filter weight controlls the number of pulses in the iir filter
   * to be 2^filterWeight where filterWeight is 1 - 31.
   */
  function PulseToVelocityIIR(pin, samples, calibration) {
    this.pin = pin;
    this.calibration = calibration;
    this.samples = samples;
    this.distanceReset = new Date();
    this.distance = 0.0;
    this.speed = 0.0;
    this.npulse = 0;
    this.pulseFrequency = 0;
    this.pulsesPerMeter = this.calibration[0].pulsesPerMeter;
    this.npulsesRecieved = 0;
    wpi.pinMode(pin, wpi.INPUT);
    wpi.pullUpDnControl(pin, wpi.PUD_UP);
    this.average = 0;
    this.lastdelta = 1000000; // long period between pulses to start with.
    var self = this;
    // the ISR function captures the last delta and number of pulses.
    wpi.wiringPiISR(pin, wpi.INT_EDGE_FALLING, function(delta) {
      self.lastdelta = delta;
      self.npulsesRecieved++;
    });
    // the IIR function needs to per called at a constant period so cant be in the ISR function.
    // if nsamples is 10, then the value will be withing 10% of the difference of the previsous constatnt value after 1s.
    // eg was 9kn, now 10kn after 1s it will read 9.9kn, and after 2s it will read 9.99kn.
    // the lower the samples, the faster the reaction and less damping.
    // previously this was inside the ISR, but since the ISR gets called a varialbe number of times per second the damping was
    // very high for low frequencies and very low for high frequencies, neither desirable.
    this.iirinterval = setInterval(function(){
      self.average = (self.average*(self.samples-1)+self.lastdelta)/self.samples;
    }, 100);

  }
  PulseToVelocityIIR.prototype.close = function() {
    // cancelISR is not supported, by the official WiringPi lib. wpi.cancelPiISR(this.pin);
    // it wont keep node open if its not canceled and replacing it with a new one will
    // probably cause it to drop. Not certain what happens to the class where it was created
    // probably just sits there as a memory leak, so dont open and close this class.
    clearInterval(this.iirinterval);
  }



  PulseToVelocityIIR.prototype.read = function() {
    if ( this.npulse === this.npulsesRecieved ) {
      // no pulses since last call, therefore velocity is 0
      this.speed = 0;
      this.pulseFrequency = 0;
      this.pulsesPerMeter = this.calibration[0].pulsesPerMeter;
      console.log("No Pulses");
      return;
    }
    // m = sum of period, hence frequency is 1/(m/numSamples ) = numSamples/m;
    // m is in ns.
    var pulseDiff = this.npulsesRecieved - this.npulse;
    this.npulse = this.npulsesRecieved;
    this.pulseFrequency = (1000000.0)/this.average;
    // the speed will be non linear wrt to speed, so lookup calibration data.
    // ms/Hz is m/s per cycles/s  and so == m per cycle or pulse, allowing trip and log.
    // this is probably more acurate if the reading is over many seconds.
    this.pulsesPerMeter = this.calibration[this.calibration.length-1].pulsesPerMeter;
    for (var i = 0; i < this.calibration.length-1; i++) {
      if ( this.pulseFrequency < this.calibration[i].frequency ) {
        this.pulsesPerMeter = this.calibration[i].pulsesPerMeter;
        break;
      }
    }
    this.distance = this.distance+(pulseDiff/this.pulsesPerMeter);
    this.speed = this.pulseFrequency/this.pulsesPerMeter;
    console.log("Pulses ", {
      npulses : pulseDiff, 
      frequencyHz : this.pulseFrequency, 
      pulsesPerM : this.pulsesPerMeter, 
      distanceTraveled : this.distance, 
      speed: MsToKn(this.speed)
    });
    return {
      distance: this.distance,
      speed: this.speed
    };
  }




  /**
   * Registers an ISR interupted on the pin storing the microseconds
   * since the last interrupt in the store. store is used as a circular buffer
   * so averaging it gives value over the last 10 samples.
   * reading provides smoothed velocity and distance.
   * the distance is based on the current puslse to distance calibration and accumulates.
   * This class uses a Moving Average for Velocity.
   */
  function PulseToVelocityMovingAverage(pin, bufsz, calibration) {
    this.pin = pin;
    this.calibration = calibration;
    this.distanceReset = new Date();
    this.distance = 0.0;
    this.speed = 0.0;
    this.store = new Array(bufsz+1);
    var store = this.store;
    // could use stats classes here but that would be expensive in runtime terms
    // the ISR needs to be fast to avoid loosing pulses.
    // the last element of store contains the number of interrupts.
    this.npulse = 0;
    this.pulseFrequency = 0;
    this.pulsesPerMeter = this.calibration[0].pulsesPerMeter;
    var i = 0, n = store.length-1;

    wpi.pinMode(pin, wpi.INPUT);
    wpi.pullUpDnControl(pin, wpi.PUD_UP);
    wpi.wiringPiISR(pin, wpi.INT_EDGE_FALLING, function(delta) {
      store[i] = delta;
      i = (i+1)%n;
      store[n]++;
    });
  };
  PulseToVelocityMovingAverage.prototype.close = function() {
    wpi.cancelPiISR(this.pin);
  };

  /**
   * Get the Velocity in m/s, calculating a moving average on get.
   */

  PulseToVelocityMovingAverage.prototype.read = function() {
    if ( this.npulse === this.store[this.store.length-1] ) {
      this.velocity = 0;
      this.pulseFrequency = 0.0;
      this.pulsesPerMeter = this.calibration[0].pulsesPerMeter;
      return;
    }
    var pulseDiff = this.store[this.store.length-1] - this.npulse;
    this.npulse = this.store[this.store.length-1];
    var m0 = 0;
    // find the average of the store, without filtering outliers.
    for (var i = 0; i < store.length-1; i++) {
      m0 = m0+store[i];
    };
    m0 = m0/(store.length-1);
    // calculate outlier thresholds of 0.2 and 2.0* the mean.
    var mmax = Math.round(m0*2.0);
    var mmin = Math.round(m0*0.2);
    var m = 0, numSamples = 0.0;
    // find the mean excluding outliers.
    for (var i = 0; i < store.length-1; i++) {
      if ( store[i] > mmin && store[i] < mmax) {
        m =  m + store[i];
        numSamples++;
      }
    };
    if ( m === 0 ) {
      // should be very rare, or impossible, and means the paddle wheel is rotataing
      // so fast the processor cant keep up with pulses. 
      // return 999 m/s
      this.pulsesPerMeter = this.calibration[this.calibration.length-1].pulsesPerMeter;
      this.distance = this.distance+(pulseDiff/this.pulsesPerMeter);
      this.speed = 999.0;
      this.pulseFrequency = 99999.0;
      return;

    } 
    // m = sum of period, hence frequency is 1/(m/numSamples ) = numSamples/m;
    // m is in ns.
    this.pulseFrequency = (1000000000.0*numSamples)/m;
    this.pulsesPerMeter = this.calibration[this.calibration.length-1].pulsesPerMeter;
    // the speed will be non linear wrt to speed, so lookup calibration data.
    for (var i = 0; i < this.calibration.length-1; i++) {
      if ( this.pulseFrequency < this.calibration[i].frequency ) {
        this.pulsesPerMeter = this.calibration[i].pulsesPerMeter;
        break;
      }
    }
    this.distance = this.distance+(pulseDiff/this.pulsesPerMeter);
    this.speed = pulseFrequency/this.pulsesPerMeter;
    return {
      distance: this.distance,
      speed: this.speed
    };
  }

  return {
    PulseToVelocityIIR : PulseToVelocityIIR,
    PulseToVelocityMovingAverage : PulseToVelocityMovingAverage
  };
}());


