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

    function FakeIMU() {
        // x and y dont move too far from vertical 45 degress max.
        this.px = new fakedata.RandomScalar(0,Math.PI/4);
        this.py = new fakedata.RandomScalar(0,Math.PI/4);
        this.pz = new fakedata.RandomAngle();
        // max gyro is Math.PI/10 in any axis (ie .341 rad/s max)
        this.gx = new fakedata.RandomScalar(-Math.PI/10,Math.PI/10);
        this.gy = new fakedata.RandomScalar(-Math.PI/10,Math.PI/10);
        this.gz = new fakedata.RandomScalar(-Math.PI/10,Math.PI/10);
    }

    FakeIMU.prototype.getValue = function(cb) {
        var self = this;
        setTimeout(function() {
            var data = {
                fusionPose: {
                    x: self.px.next(),
                    y: self.py.next(),
                    z: self.pz.next()
                },
                gyro: {
                    x: self.gx.next(),
                    y: self.gy.next(),
                    z: self.gz.next()

                }
            }
            cb(false, data);
        }, 10);
    };


  return {
    FakeIMU : FakeIMU
  };
}());

