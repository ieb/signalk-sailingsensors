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
const adclib = require('./adc');
  

var adc = new adclib.ADC(0x48, 'dev/i2c-1');

var maximums = [6000,6000];
var minimums = [2000,2000];
var angleV = [0,1];
setInterval(function() {
    adc.readChannels(0, [0,1], [], function(e, data) {
        if (e) {
          console.log("Oops:", e);
          return;
        }
        for (var i = 0; i < angleV.length; i++) {
            maximums[i] = Math.max(maximums[i],data[i]);
            minimums[i] = Math.min(minimums[i],data[i]);
            if ( maximums[i] == minimums[i]) {
                angleV[i] = 0.0;
             } else {
                angleV[i] = Math.min(1.0,Math.max(0.0,(data[i]-minimums[i])/(maximums[i]-minimums[i])));
             }
        };
        var result = {
            sinV: Math.asin(angleV[0]),
            cosV: Math.acos(angleV[1]),
            angle: Math.atan2(angleV[0],angleV[1]),
            // this is an indication of if the max and min are correct. non zero indicates that the max and min are not correct or the sin/cos are non linear
            err: Math.asin(angleV[0])+Math.acos(angleV[1])-Math.PI/2, 
            angleV : angleV,
            max : maximums,
            min: minimums,
            data: data
        }


        console.log(result);
      });
    }, 1000);



