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


  function RandomAngle() {
    this.c = 0;
  }
  RandomAngle.prototype.next = function() {
    this.c = this.c + ((Math.random()-0.5)*Math.PI/90);
    if ( this.c > Math.PI*2 ) {
      this.c = this.c - Math.PI*2;
    } else if ( this.c < 0 ) {
      this.c = this.c + Math.PI*2;
    } 
    return this.c;
  };


  function RandomScalar(min, max) {
    this.v = 0;
    this.c = 0;
    this.r = max - min;
    this.mean = (max+min)/2;
    this.min = min;
    this.max = max;
  }
  RandomScalar.prototype.next = function() {
    this.v = this.v - ((Math.random()-0.5-(this.v/(5*this.r))) * (this.v-this.r)/10);
    this.c = this.mean + this.v;
    if ( this.c > this.max ) {
      this.c = this.max;
    } else if ( this.c < this.min ) {
      this.c = this.min;
    } 
    return this.c;
  };


  return {
    RandomScalar : RandomScalar,
    RandomAngle : RandomAngle
  };
}());

