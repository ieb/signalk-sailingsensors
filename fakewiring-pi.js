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


   function wiringPiSetupSys() {

   }
   function pinMode() {

   }
   function pullUpDnControl() {

   }
   var intervalPins = {};
   function wiringPiISR(pin, edge, cb) {
      var speed =  new fakedata.RandomScalar(0.5,15);
      intervalPins[pin] = setInterval(function() {
        var frequency = speed.next()*5.5;  // for water max is 15kn for winf max is 78kn (15*5.5/1.045)
        var period = 1000000000/frequency; 
        cb(period);  
      }, 100);
   }

   function cancelPiISR(pin) {
      intervalPins[pin].cancelInterval();
   }

  return {
    wiringPiSetupSys : wiringPiSetupSys,
    pinMode: pinMode,
    pullUpDnControl: pullUpDnControl,
    wiringPiISR : wiringPiISR
  };
}());

