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
  var IMU; 
  try {
    const ads1x15 = require('node-ads1x15');
    // there is a nodeimu on OSX, however it doesnt work, so the above like will
    // fail and load the fake.
    IMU = new (require('nodeimu')).IMU();        
  } catch (e) {
    IMU = new (require('./fakeimu')).FakeIMU();
    console.log("Loaded Fake IMU cause:", e);
  }








  /**
   * Statistics container for roll pitch and yaw over n samples.
   * roll and pitch as assumed to average as a scalar in radian, with no curcular wrapping.
   * this remains true as long as the  angles dont go over 90 degrees, which they should not
   * hopefully.
   * Yaw is averaged as an angle, averaging each component and is expeted to go over 90 degrees.
   */
  function Pose(n) {
    // pitch and role should never (hopefully) wrap, so standard stats are Ok.
    // yaw may go -170 +170 which should give a mean of -180 or +180, not 0,
    // hence an angular mean is required.
      this.roll = new stats.Stats(n, "pose.roll");
      this.pitch = new stats.Stats(n, "pose.pitch");
      this.yaw = new stats.AngleStats(n, "pose.yaw");
  }
  Pose.prototype.set = function(vec) {
    this.roll.set(vec.x);
    this.pitch.set(vec.y);
    this.yaw.set(vec.z);
  };
  Pose.prototype.yawToHeading = function(deviation) {
    var heading = this.yaw.c - deviation;
    if ( this.yaw < Math.PI/2) {
      heading = heading + 1.5*Math.PI;
    } else {
      heading = heading - Math.PI/2;
    }
    if ( heading < 0) {
      heading = heading + 2*Math.PI;
    }
    if ( heading > 2*Math.PI) {
      heading = heading - 2*Math.PI;
    }
    return heading;
  }


  /**
   * Rate gyro averaging as scalars.
   */
  function RateGyro(n) {
    // Although rate gyro is r/s the r/s is not circular so a standard statistic is appropriate.
      this.roll = new stats.Stats(n, "rate.roll");
      this.pitch = new stats.Stats(n, "rate.pitch");
      this.yaw = new stats.Stats(n,"rate.yaw");
  }
  RateGyro.prototype.set = function(vec) {
    this.roll.set(vec.x);
    this.pitch.set(vec.y);
    this.yaw.set(vec.z);
  };

  function read(pose, rateGyro) {
    if ( typeof pose === "function" ) {
      IMU.getValue(pose);
    } else {
      IMU.getValue(function(e, data) {
        if (e) {
          console.log("A",e);
          return;
        }
        pose.set(data.fusionPose);
        rateGyro.set(data.gyro);
      });      
    }
  }







  return {
    Pose: Pose,
    RateGyro: RateGyro,
    read: read

  };
}());

