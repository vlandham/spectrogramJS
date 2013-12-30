
// var WIDTH = 640;
// var HEIGHT = 360;

// Interesting parameters to tweak!
var SMOOTHING = 0.0;
var FFT_SIZE = 2048;
// var SAMPLE = 2048;
// var SAMPLE = 1024;
var SAMPLE = 512;
var MIN_DEC = -140.0;
var MAX_DEC = 100.0;

function VisualizerSample() {
  this.analyser = context.createAnalyser();
  this.javascriptNode = context.createScriptProcessor(SAMPLE, 1, 1);

  // this.analyser.connect(context.destination);
  this.analyser.minDecibels = MIN_DEC;
  this.analyser.maxDecibels = MAX_DEC;

  this.analyser.smoothingTimeConstant = SMOOTHING;
  this.analyser.fftSize = FFT_SIZE;

  loadSounds(this, {
    buffer: 'data/bird_short.ogg'
    //buffer: 'sound.wav'
  }, this.setupVisual.bind(this));
  this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
  // this.times = new Uint8Array(this.analyser.frequencyBinCount);
  this.data = [];
  // this.freqsFloat = new Float32Array(this.analyser.frequencyBinCount);

  this.isPlaying = false;
  this.startTime = 0;
  this.startOffset = 0;
  this.count = 0;
  this.curSec = 0;
  this.curSample = 0;
  this.maxCount = 0;
  // this.setupVisual();
}

VisualizerSample.prototype.process = function(e) {
  if(this.isPlaying) {
    // console.log(this.javascriptNode.bufferSize);
    this.count += 1;
    this.curSample += SAMPLE;
    this.curSec =  (SAMPLE * this.count) / this.buffer.sampleRate;
    console.log(this.curSec);
    // console.log(this.curSample);
    // console.log(this.curSec);
    this.analyser.getByteFrequencyData(this.freqs);
    // this.analyser.getFloatFrequencyData(this.freqsFloat);
    // if(this.count == 40) {
    //   console.log(this.data);
    // }
    // this.analyser.getByteTimeDomainData(this.times);

    var d = {'key':this.curSec, 'values':new Uint8Array(this.freqs)};
    this.data.push(d);
    if(this.count >= this.maxCount) {
      this.togglePlayback()
      // console.log(this.count);
      this.draw();
    }
  }
}

VisualizerSample.prototype.setupVisual = function() {
  var width = 900;
  var height = 500;
  var margin = {top: 20, right: 20, bottom: 30, left: 50};
  this.svg = d3.select("#vis").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  console.log(this.buffer.duration);

  this.maxCount = (context.sampleRate / SAMPLE) * this.buffer.duration;


  // console.log(context.sampleRate);
  this.dotWidth = width / this.maxCount;
  this.dotHeight = height / this.analyser.frequencyBinCount;
  // console.log(this.dotWidth);


  this.xScale = d3.scale.linear()
    .domain([0, this.buffer.duration])
    .range([0, width]);

  this.yScale = d3.scale.linear()
    .domain([this.getBinFrequency(0), this.getBinFrequency(this.analyser.frequencyBinCount / 2)])
    .range([height,0]);

  this.zScale = d3.scale.linear()
    .domain([-2, MAX_DEC])
    .range(["white", "purple"])
    .interpolate(d3.interpolateLab);

  this.xAxis = d3.svg.axis()
    .scale(this.xScale)
    .orient("bottom");

  this.yAxis = d3.svg.axis()
    .scale(this.yScale)
    .orient("left");
  
  this.svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(this.xAxis);

  this.svg.append("g")
    .attr("class", "y axis")
    .call(this.yAxis)
}

// Toggle playback
VisualizerSample.prototype.togglePlayback = function() {
  if (this.isPlaying) {
    // Stop playback
    this.source.noteOff(0);
    this.startOffset += context.currentTime - this.startTime;
    console.log('paused at', this.startOffset);
    // Save the position of the play head.
  } else {
    this.startTime = context.currentTime;
    console.log('started at', this.startOffset);
    this.source = context.createBufferSource();
    this.source.buffer = this.buffer;
    this.analyser.buffer = this.buffer;
    // this.javascriptNode.buffer = this.buffer;
    this.javascriptNode.onaudioprocess = this.process.bind(this);
    // Connect graph
    this.source.connect(this.analyser);
    this.analyser.connect(this.javascriptNode);

    this.source.connect(context.destination);
    this.javascriptNode.connect(context.destination);

    this.source.loop = false;
    // Start playback, but make sure we stay in bound of the buffer.
    this.source.start(0, this.startOffset % this.buffer.duration);
    // Start visualizer.
    // requestAnimFrame(this.draw.bind(this));
  }
  this.isPlaying = !this.isPlaying;
}

VisualizerSample.prototype.draw = function() {
  var that = this;

  var date = this.svg.selectAll(".date")
    .data(this.data)
    .enter().append("g")
    .attr("class", "date")
    .attr("transform", function(d) { return "translate(" + that.xScale(d.key) + ",0)"; });

  date.selectAll(".bin")
    .data(function(d) { return d.values; })
    .enter().append("rect")
    .attr("class", "bin")
    .attr("y", function(d,i) { return that.yScale(that.getBinFrequency(i)); })
    // .attr("height", function(d) { return y(d.x) - y(d.x + d.dx); })
    .attr("height", function(d) { return that.dotHeight; })
    .attr("width", function(d) { return that.dotWidth; })
    .style("fill", function(d) { return that.zScale(d); });

  
  // var width = Math.floor(1/this.freqs.length, 10);

  // var canvas = document.querySelector('canvas');
  // var drawContext = canvas.getContext('2d');
  // canvas.width = WIDTH;
  // canvas.height = HEIGHT;
  // // Draw the frequency domain chart.
  // for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
  //   var value = this.freqs[i];
  //   var percent = value / 256;
  //   var height = HEIGHT * percent;
  //   var offset = HEIGHT - height - 1;
  //   var barWidth = WIDTH/this.analyser.frequencyBinCount;
  //   var hue = i/this.analyser.frequencyBinCount * 360;
  //   drawContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
  //   drawContext.fillRect(i * barWidth, offset, barWidth, height);
  // }

  // Draw the time domain chart.
  // for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
  //   var value = this.times[i];
  //   var percent = value / 256;
  //   var height = HEIGHT * percent;
  //   var offset = HEIGHT - height - 1;
  //   var barWidth = WIDTH/this.analyser.frequencyBinCount;
  //   drawContext.fillStyle = 'white';
  //   drawContext.fillRect(i * barWidth, offset, 1, 2);
  // }

  if (this.isPlaying) {
    // requestAnimFrame(this.draw.bind(this));
  }
}

VisualizerSample.prototype.getFrequencyValue = function(freq) {
  var nyquist = context.sampleRate/2;
  var index = Math.round(freq/nyquist * this.freqs.length);
  return this.freqs[index];
}

VisualizerSample.prototype.getBinFrequency = function(index) {
  var nyquist = context.sampleRate/2;
  var freq = index / this.freqs.length * nyquist;
  return freq;
}
