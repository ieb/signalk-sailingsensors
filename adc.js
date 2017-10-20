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
  var ads1x15; 
  try {
    ads1x15 = require('node-ads1x15')
  } catch (e) {
    ads1x15 = require('./fakeads1x15');
    console.log("Loaded Fake asd cause:", e);
  }


  // =======================================MUX ADC Wrapper using ADS1115 chip on I2C.
  // this chip can do upto 3K samples/s, run it at 250 Hz and 4.096v +-. 
  function ADC(address, bus) {
      // 1 mans a ads1115 chip

      this.adc = new ads1x15(1, address, bus);
      this.samplesPerSecond = '250'; // see index.js for allowed values for your chip  
      this.progGainAmp = '4096'; // see index.js for allowed values for your chip  
  }


  ADC.prototype.readChannels = function(channel, chmap, voltages, cb) {
    var self = this;
    this.adc.readADCSingleEnded(chmap[channel], this.progGainAmp, this.samplesPerSecond, function(err, data) {
        if(err) {
          cb(err, voltages);
        }
        voltages[channel] = data;
        channel++;
        if ( channel < chmap.length) {
          self.readChannels(channel, chmap, voltages, cb);
        } else {
          cb(false, voltages);
        }
    });
  };

  return {
    ADC : ADC
  };
}());

