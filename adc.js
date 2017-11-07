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
  try {
    const ADS1x15_POINTER_CONVERSION = 0x00;
    const ADS1x15_POINTER_CONFIG = 0x01;

    const i2c = require('i2c');

    function byteSwap16(v) {
      return ((v >> 8) & 0xFF) + ((v << 8) & 0xFF00);
    }
    /**
     * Stats conversions.
     */
    var ADS1115 = function(address, readPeriodMs, iirFilter) {
      this.wire = new i2c(address, {device: '/dev/i2c-1'}); 
      this.channelNumber = 0;
      this.config =  
        0x8000 | // ADS1x15_CONFIG_OS_SINGLE (waker from shutdown) 
        0x0200 | // ADS1x15_CONFIG_GAIN (1x gain +/- 4.096v)
        0x0100 | // ADS1x15_CONFIG_MODE_SINGLE (power-down single shot mode) 
        0x00A0 | // 250 samples per second (default)
        0x0003; // ADS1x15_CONFIG_COMP_QUE_DISABLE (Disable the comparitor)
      this.rate = 250;
      this.gain = 4096;
      this.iirFilter = iirFilter;
      // wait 1ms between channels, but wait readPeriodMs after the last channel to 
      // ensure that the reads are all close together and the rate of read is as requested.
      this.delayAfterRead = [1,1,1,readPeriodMs];
      // output voltages.
      this.voltages = [0.0,0.0,0.0,0.0];
      this.lastReadError = false;
      this.lastWriteError = false;
      this.readErrors = 0;
      this.writeErrors = 0;
      this.reads = 0;
      // start reading.
      this._readch();
    }

    ADS1115.prototype.status = function(ch) {
      console.log(this.reads, this.readErrors, this.writeErrors, this.lastReadError, this.lastWriteError, this.voltages);
      this.reads = 0;
    };

    ADS1115.prototype.getVoltages = function(ch) {
      return this.voltages;
    };

    ADS1115.prototype._readch = function() {
      var self = this;
      var finalConfig = this.config | ((self.channelNumber+4) & 0x07) << 12;

      self.wire.writeBytes(ADS1x15_POINTER_CONFIG, [ finalConfig >> 8 & 0xff, finalConfig & 0xff ], function(err) {
        if (err) {
          self.writeErrors++;
          self.lastWriteError = err;
          setTimeout(function() {
              // retry
              self._readch();
            }, 1000);        
        } else {
          var delay = 1+1000/self.rate;
          setTimeout(function(){
            // read the conversion result register, 2 bytes.
            self.wire.readBytes(ADS1x15_POINTER_CONVERSION, 2, function(err, res) {
              if (err) {
                self.readErrors++;
                self.lastReadError = err;
                setTimeout(function() {
                    // retry
                    self._readch();
                  }, 1000);                        
              } else {
                var value = ((res[0] & 0xFF) << 8) | (res[1] & 0xFF);
                if ((value & 0x8000) !== 0) {
                    value -= 1 << 16;
                }
                // console.log(self.channelNumber, delay, "Read result ",val);
                // due to the internal resistance, in single ended mode the output my be -ve ie the 16th bit is set.
                var voltage = 0;
                if ( value > 0 ) {
                  voltage = value * self.gain / 32768.0;
                }
                if ( self.iirFilter[self.channelNumber] === 0 ) {
                  // no iir filter.
                  self.voltages[self.channelNumber] = voltage;
                } else {
                  // apply an iir filter.
                  self.voltages[self.channelNumber] = self.voltages[self.channelNumber]+
                      (voltage-self.voltages[self.channelNumber])/self.iirFilter[self.channelNumber];                  
                }
                // delay then read the next channel.
                setTimeout(function() {
                  self.channelNumber = (self.channelNumber+1)%self.voltages.length;
                  self.reads++;
                  self._readch();
                }, self.delayAfterRead[self.channelNumber]);                
              }
            });
          }, delay);
        }          
      });
    };
  } catch (e) {
    function ADS1115(address, readPeriodMs, iirFilter) {
    }
    ADS1115.prototype.getVoltages = function(ch) {
      return [1.0,1.1,1.2,1,3];
    };
    console.log("Loaded Fake asd cause:", e);
  }

  var registeredADCs = {};

  function getADC(address,  readPeriodMs, iirFilter) {
    if ( registeredADCs[address] === undefined) {
      registeredADCs[address] = new ADS1115(address,  readPeriodMs, iirFilter);
    }
    return registeredADCs[address]; 
  }

  return {
    getADC : getADC
  };
}());

