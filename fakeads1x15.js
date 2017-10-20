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

    var fakedata = require("./fakedata")

    var angle =  new fakedata.RandomAngle();
    /**
     * The real hardware + npm returns mV.
     * 
     */
    function Ads1x15() {
    }

    /**
     * Return the reading in mV.
     */
    Ads1x15.prototype.readADCSingleEnded = function(ch, progGainAmp, samplesPerSecond, cb) {
        var mV;
        if ( ch === 0) {
            angle.next();
            console.log("Angle is ",angle.c);
            mV = (4+2*Math.sin(angle.c))*2/3; // Divider is a 2/3 divider, input voltage is sin mean 4v amplitude 4v.
        } else {
            mV = (4*2*Math.cos(angle.c))*2/3;
        }
        setTimeout(function() {
            cb(false, mV);
        }, 10);

    };

  return Ads1x15;
}());

