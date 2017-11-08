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


const pulsesensor = require("./pulsesensor");
function MsToKn(v) {
  return v*3600.0/1852.0;
}

var windCalibration = [
      // linear response of 1.045Hz per kn
      // conversion is 1/KnToMS so use MSToKn
        {
         frequency: 0,
         pulsesPerMeter: MsToKn(1.045)           
        }
      ];
var waterCalibration = [
      // linear response of 1.045Hz per kn
      // conversion is 1/KnToMS so use MSToKn
        {
         frequency: 0,
         pulsesPerMeter: MsToKn(5.5)           
        }
      ];


var waterSpeedSensor = new pulsesensor.PulseToVelocityIIR(5, 5, waterCalibration);
var windSpeedSensor = new pulsesensor.PulseToVelocityIIR(6, 5, windCalibration);

    // register a timer for getting IMU data
setInterval(function() {
    console.log("WindSpeed ", windSpeedSensor.read());
    console.log("WaterSpeed", waterSpeedSensor.read());
  }, 1000);


