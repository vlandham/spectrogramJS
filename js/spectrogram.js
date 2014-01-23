
// shim requestAnimFrame for animating playback
window.requestAnimFrame = (function(){
return  window.requestAnimationFrame       || 
  window.webkitRequestAnimationFrame || 
  window.mozRequestAnimationFrame    || 
  window.oRequestAnimationFrame      || 
  window.msRequestAnimationFrame     || 
  function( callback ){
  window.setTimeout(callback, 1000 / 60);
};
})();

window.AudioContext = window.AudioContext || window.webkitAudioContext;

// helper function for loading one or more sound files
function loadSounds(obj, context, soundMap, callback) {
  var names = [];
  var paths = [];
  for (var name in soundMap) {
    var path = soundMap[name];
    names.push(name);
    paths.push(path);
  }
  bufferLoader = new BufferLoader(context, paths, function(bufferList) {
    for (var i = 0; i < bufferList.length; i++) {
      var buffer = bufferList[i];
      var name = names[i];
      obj[name] = buffer;
    }
    if (callback) {
      callback();
    }
  });
  bufferLoader.load();
}

// class that performs most of the work to load
// a new sound file asynchronously
// originally from: http://chimera.labs.oreilly.com/books/1234000001552/ch02.html
function BufferLoader(context, urlList, callback) {
  this.context = context;
  this.urlList = urlList;
  this.onload = callback;
  this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  var loader = this;

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          alert('error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        console.error('decodeAudioData error', error);
      }
    );
  }

  request.onerror = function() {
    alert('BufferLoader: XHR error');
  }
  request.send();
};

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
};

// ---
// Spectrogram class 
// constructor takes a filename, selector id to use to figure 
// out where to display, and a big options hash.
// (not a great api - I know!)
// sets up most of the configuration for the sound analysis
// and then loads the sound using loadSounds.
// Once finished loading, the setupVisual callback
// is called.
// ---
function Spectrogram(filename, selector, options) {
  if (!options) {
    options = {};
  }
  this.options = options;

  var SMOOTHING = 0.0;
  var FFT_SIZE = 2048;

  // this.sampleRate = 256;
  this.sampleRate = options.sampleSize || 512;
  this.decRange = [-80.0, 80.0];

  this.width = options.width || 900;
  this.height = options.height || 440;
  this.margin = {top: 20, right: 20, bottom: 30, left: 50};

  this.selector = selector;
  this.filename = filename;
  this.context = context = new AudioContext();
  this.analyser = context.createAnalyser();
  this.javascriptNode = context.createScriptProcessor(this.sampleRate, 1, 1);

  this.analyser.minDecibels = this.decRange[0];
  this.analyser.maxDecibels = this.decRange[1];

  this.analyser.smoothingTimeConstant = SMOOTHING;
  this.analyser.fftSize = FFT_SIZE;


  this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
  this.data = [];

  this.isPlaying = false;
  this.isLoaded = false;
  this.startTime = 0;
  this.startOffset = 0;
  this.count = 0;
  this.curSec = 0;
  this.maxCount = 0;

  loadSounds(this, this.context, {
    buffer: this.filename
  }, this.setupVisual.bind(this));
}

// ---
// process
// callback executed each onaudioprocess of the javascriptNode.
// performs the work of analyzing the sound and storing the results
// in a big array (not a great idea, but I haven't thought of something
// better.
// ---
Spectrogram.prototype.process = function(e) {
  if(this.isPlaying && !this.isLoaded) {
    this.count += 1;
    this.curSec =  (this.sampleRate * this.count) / this.buffer.sampleRate;
    this.analyser.getByteFrequencyData(this.freqs);

    var d = {'key':this.curSec, 'values':new Uint8Array(this.freqs)};
    this.data.push(d);
    if(this.count >= this.maxCount) {
      this.switchButtonText();
      this.togglePlayback();
      this.draw();
      this.isLoaded = true;
      console.log(this.data.length);
      console.log(this.data[0].values.length);
    }
  }
}

// ---
// setupVisual
// callback executed when the sound has been loaded. 
// sets up scales and other components needed to visualize.
// ---
Spectrogram.prototype.setupVisual = function() {

  console.log(this.context.sampleRate);

  // can configure these from the options
  this.timeRange = [0, this.buffer.duration];
  var maxFrequency = this.options.maxFrequency || this.getBinFrequency(this.analyser.frequencyBinCount / 2);
  var minFrequency = this.options.minFrequency || this.getBinFrequency(0);
  this.freqRange = [minFrequency, maxFrequency];

  this.svg = d3.select(this.selector).append("svg")
    .attr("width", this.width + this.margin.left + this.margin.right)
    .attr("height", this.height + this.margin.top + this.margin.bottom)
    .append("g")
    .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

  this.canvas = d3.select(this.selector).append("canvas")
    .attr("class", "vis_canvas")
    .attr("width", this.width + this.margin.left)
    .attr("height", this.height + this.margin.top)
    .style("padding", d3.map(this.margin).values().join("px ") + "px");

  this.progressLine = this.svg.append("line");

  var that = this;
  var button_id = this.selector + "_button";
  this.button = d3.select(this.selector).append("button")
    .style("margin-top", this.height + this.margin.top + this.margin.bottom + 20 + "px")
    .attr("id", button_id)
    .text("analyze")
    .on("click", function() {
      that.togglePlayback();
    });

  var freqs = [];
  for(i = 64; i < this.analyser.frequencyBinCount; i += 64) {
    freqs.push(d3.round(this.getBinFrequency(i), 4));
  }

  this.freqSelect = d3.select(this.selector).append("select")
    .style("margin-top", this.height + this.margin.top + this.margin.bottom + 20 + "px")
    .style("margin-left", "20px")
    .on("change", function() {
      var newFreq = this.options[this.selectedIndex].value
      console.log(newFreq);
      that.yScale.domain([0, newFreq]);
      that.draw();
    });

  this.freqSelect.selectAll('option')
    .data(freqs).enter()
    .append("option")
    .attr("value", function(d) { return d;})
    .attr("selected", function(d,i) { return (d == 11047) ? "selected" : null;})
    .text(function(d) { return d3.round(d / 1000) + "k";});

  this.maxCount = (this.context.sampleRate / this.sampleRate) * this.buffer.duration;

  this.xScale = d3.scale.linear()
    .domain(this.timeRange)
    .range([0, this.width]);

  this.yScale = d3.scale.linear()
    .domain(this.freqRange)
    .range([this.height,0]);

  this.zScale = d3.scale.linear()
    .domain(this.decRange)
    .range(["white", "black"])
    .interpolate(d3.interpolateLab);

  var commasFormatter = d3.format(",.1f");
  this.xAxis = d3.svg.axis()
    .scale(this.xScale)
    .orient("bottom")
    .tickSize(-this.height - 15)
    .tickPadding(10)
    .tickFormat(function(d) {return commasFormatter(d) + "s";});

  this.yAxis = d3.svg.axis()
    .scale(this.yScale)
    .orient("left")
    .tickSize(-this.width - 10, 0, 0)
    .tickPadding(10)
    .tickFormat(function(d) {return d3.round(d / 1000, 0) + "k";});
  
  this.svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + (this.height + 10)  + ")")
    .call(this.xAxis);

  this.svg.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(" + (-10) + ",0)")
    .call(this.yAxis)
}

// ---
// showProgress
// ---
Spectrogram.prototype.showProgress = function() {
  if(this.isPlaying && this.isLoaded) {
    this.curDuration = (this.context.currentTime - this.startTime);
    // this.count += 1;
    // this.curSec = (this.sampleRate * this.count) / this.buffer.sampleRate;
    var that = this;
    this.progressLine
      .attr("x1", function() {return that.xScale(that.curDuration);})
      .attr("x2", function() {return that.xScale(that.curDuration);})
      .attr("y1", 0)
      .attr("y2", this.height)
      .attr("stroke",'red')
      .attr("stroke-width", 2.0);

    requestAnimFrame(this.showProgress.bind(this));

    if(this.curDuration >= this.buffer.duration) {
      this.progressLine.attr("y2", 0);
      this.togglePlayback()
    }
  }
}

// ---
// Little helper function to change the text on the button
// after the sound has been analyzed.
// ---
Spectrogram.prototype.switchButtonText = function() {
  this.button.text("play");
}

// ---
// Toggle playback
// ---
Spectrogram.prototype.togglePlayback = function() {
  if (this.isPlaying) {
    this.source.stop(0);
    this.startOffset += this.context.currentTime - this.startTime;
    console.log('paused at', this.startOffset);
    this.button.attr("disabled", null);
  } else {
    this.button.attr("disabled", true);
    this.startTime = this.context.currentTime;
    this.count = 0;
    this.curSec = 0;
    this.curDuration = 0;
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.analyser.buffer = this.buffer;
    this.javascriptNode.onaudioprocess = this.process.bind(this);

    // Connect graph
    this.source.connect(this.analyser);
    this.analyser.connect(this.javascriptNode);

    this.source.connect(this.context.destination);
    this.javascriptNode.connect(this.context.destination);

    this.source.loop = false;
    this.source.start(0, this.startOffset % this.buffer.duration);

    console.log('started at', this.startOffset);
    
    if (this.isLoaded) {
      requestAnimFrame(this.showProgress.bind(this));
    }
  }
  this.isPlaying = !this.isPlaying;
}

// ---
// ---
Spectrogram.prototype.draw = function() {
  var that = this;

  var min = d3.min(this.data, function(d) { return d3.min(d.values)});
  var max = d3.max(this.data, function(d) { return d3.max(d.values)});
  this.zScale.domain([min + 20, max - 20]);

  this.dotWidth = this.width / this.maxCount;
  this.dotHeight = this.height / this.analyser.frequencyBinCount;

  var visContext = d3.select(this.selector).select(".vis_canvas")[0][0].getContext('2d');

  this.svg.select(".x.axis").call(this.xAxis);
  this.svg.select(".y.axis").call(this.yAxis);

  visContext.clearRect( 0, 0, this.width + this.margin.left, this.height );

  // display as canvas here.
  this.data.forEach(function(d) {
    for(var i = 0; i < d.values.length - 1; i++) {
      var v = d.values[i];
      var x = that.xScale(d.key);
      var y = that.yScale(that.getBinFrequency(i));
      visContext.fillStyle = that.zScale(v);
      visContext.fillRect(x,y,that.dotWidth, that.dotHeight);
    }
  });
}

// ---
// ---
Spectrogram.prototype.getFrequencyValue = function(freq) {
  var nyquist = this.context.sampleRate/2;
  var index = Math.round(freq/nyquist * this.freqs.length);
  return this.freqs[index];
}

// ---
// ---
Spectrogram.prototype.getBinFrequency = function(index) {
  var nyquist = this.context.sampleRate/2;
  var freq = index / this.freqs.length * nyquist;
  return freq;
}
