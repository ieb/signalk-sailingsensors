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

// test calculating wind angle using ADC at 20Hz. This uses about 0.1% of a core on a Pi3.  
// the ADC running at 250 samples per second on 4ch will sample at about 200Hz with multiplexing and
// the the I2C overhead.

// run the ADC at 50ms intervals with a IIR filter of 10 on the first 2 channels and 100 on the others.
var adc = new adclib.getADC(0x48,50, [10,10,100,100]);

var maximums = [0,0];
var minimums = [6000,6000];
var angleV = [0,1];
setInterval(function() {
    var voltages = adc.getVoltages();
    for (var i = 0; i < voltages.length; i++) {
        maximums[i] = Math.max(maximums[i],voltages[i]);
        minimums[i] = Math.min(minimums[i],voltages[i]);
        var range = (maximums[i] - minimums[i])/2;
        var mean = (maximums[i] + minimums[i])/2.0;
        if ( range < 1E-3) {
            angleV[i] = 0.0;
         } else {
            angleV[i] = Math.min(1.0,Math.max(-1.0,(voltages[i]-mean)/range));
         }
    };
    var result = {
        //sinV: Math.asin(angleV[0]),
        //cosV: Math.acos(angleV[1]),
        angle: Math.atan2(angleV[0],angleV[1]),
        angleDeg: (Math.atan2(angleV[0],angleV[1])*180)/Math.PI,
        // this is an indication of if the max and min are correct. non zero indicates that the max and min are not correct or the sin/cos are non linear
        // err: Math.asin(angleV[0])+Math.acos(angleV[1])-Math.PI/2, 
        angleV : angleV,
        max : maximums,
        min: minimums,
        voltages: voltages
    }


    //console.log(result);
    console.log(Math.round(result.angleDeg));
}, 50);



