
var SMOOTHING = 0.0;
var FFT_SIZE = 2048;
var SAMPLE = 512;
var MIN_DEC = -80.0;
var MAX_DEC = 80.0;

function VisualizerSample(filename, selector) {
  this.selector = selector;
  this.filename = filename;
  this.analyser = context.createAnalyser();
  this.javascriptNode = context.createScriptProcessor(SAMPLE, 1, 1);

  this.analyser.minDecibels = MIN_DEC;
  this.analyser.maxDecibels = MAX_DEC;

  this.analyser.smoothingTimeConstant = SMOOTHING;
  this.analyser.fftSize = FFT_SIZE;

  loadSounds(this, {
    buffer: this.filename
  }, this.setupVisual.bind(this));

  this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
  this.data = [];

  this.isPlaying = false;
  this.isLoaded = false;
  this.startTime = 0;
  this.startOffset = 0;
  this.count = 0;
  this.curSec = 0;
  this.maxCount = 0;
}

VisualizerSample.prototype.process = function(e) {
  if(this.isPlaying && !this.isLoaded) {
    this.count += 1;
    this.curSec =  (SAMPLE * this.count) / this.buffer.sampleRate;
    this.analyser.getByteFrequencyData(this.freqs);

    var d = {'key':this.curSec, 'values':new Uint8Array(this.freqs)};
    this.data.push(d);
    if(this.count >= this.maxCount) {
      this.togglePlayback()
      this.draw();
    }
  }
}

VisualizerSample.prototype.setupVisual = function() {
  var width = 900;
  var height = 500;
  var margin = {top: 20, right: 20, bottom: 30, left: 50};

  this.svg = d3.select(this.selector).append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  this.canvas = d3.select(this.selector).append("canvas")
    .attr("id", "vis_canvas")
    .attr("width", width + margin.left)
    .attr("height", height + margin.top)
    .style("padding", d3.map(margin).values().join("px ") + "px");

  this.progressLine = this.svg.append("line");

  var that = this;
  var button_id = this.selector + "_button";
  d3.select(this.selector).append("button")
    .style("margin-top", height + margin.top + margin.bottom + 20 + "px")
    .attr("id", button_id)
    .text("play")
    .on("click", function() {
      that.togglePlayback();
    });

  this.maxCount = (context.sampleRate / SAMPLE) * this.buffer.duration;

  this.dotWidth = width / this.maxCount;
  this.dotHeight = height / this.analyser.frequencyBinCount;

  this.xScale = d3.scale.linear()
    .domain([0, this.buffer.duration])
    .range([0, width]);

  this.yScale = d3.scale.linear()
    .domain([this.getBinFrequency(0), this.getBinFrequency(this.analyser.frequencyBinCount / 2)])
    .range([height,0]);

  this.zScale = d3.scale.linear()
    .domain([MIN_DEC, MAX_DEC])
    .range(["white", "black"])
    .interpolate(d3.interpolateLab);

  var commasFormatter = d3.format(",.1f");
  this.xAxis = d3.svg.axis()
    .scale(this.xScale)
    .orient("bottom")
    .tickSize(-height - 15)
    .tickPadding(10)
    .tickFormat(function(d) {return commasFormatter(d) + "s";});

  this.yAxis = d3.svg.axis()
    .scale(this.yScale)
    .orient("left")
    .tickSize(-width - 10, 0, 0)
    .tickPadding(10)
    .tickFormat(function(d) {return d3.round(d / 1000, 0) + "k";});
  
  this.svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + (height + 10)  + ")")
    .call(this.xAxis);

  this.svg.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(" + (-10) + ",0)")
    .call(this.yAxis)
}

VisualizerSample.prototype.showProgress = function() {
  if(this.isPlaying && this.isLoaded) {
    this.count += 1;
    this.curSec =  (SAMPLE * this.count) / this.buffer.sampleRate;
    console.log(this.progressLine);
    requestAnimFrame(this.showProgress.bind(this));
    if(this.count >= this.maxCount) {
      this.togglePlayback()
    }
  }
}

// Toggle playback
VisualizerSample.prototype.togglePlayback = function() {
  if (this.isPlaying  && !this.isLoaded) {
    // Stop playback
    this.source.noteOff(0);
    this.startOffset += context.currentTime - this.startTime;
    console.log('paused at', this.startOffset);
    // Save the position of the play head.
  } else {
    this.count = 0;
    this.curSec = 0;
    this.startTime = context.currentTime;
    console.log('started at', this.startOffset);
    this.source = context.createBufferSource();
    this.source.buffer = this.buffer;
    this.analyser.buffer = this.buffer;
    this.javascriptNode.onaudioprocess = this.process.bind(this);

    // Connect graph
    this.source.connect(this.analyser);
    this.analyser.connect(this.javascriptNode);

    this.source.connect(context.destination);
    this.javascriptNode.connect(context.destination);

    this.source.loop = false;
    this.source.start(0, this.startOffset % this.buffer.duration);
    
    if (this.isLoaded) {
      requestAnimFrame(this.showProgress.bind(this));
    }
  }
  this.isPlaying = !this.isPlaying;
}

VisualizerSample.prototype.draw = function() {
  var that = this;

  var min = d3.min(this.data, function(d) { return d3.min(d.values)});
  var max = d3.max(this.data, function(d) { return d3.max(d.values)});
  this.zScale.domain([min + 20, max - 20]);

  var visContext = document.getElementById('vis_canvas').getContext('2d');

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

  this.isLoaded = true;
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
