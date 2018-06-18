/*eslint-disable no-unused-lets*/
/*global d3*/
// 'use strict';

/**
 * optimize the animation - shim requestAnimFrame for animating playback
 */
window.requestAnimFrame = window.requestAnimationFrame ||
    function(callback) {
        window.setTimeout(callback, 1000 / 60);
    };

/**
 * Helper function for loading one or more sound files
 */
function loadSounds(obj, context, soundMap, callback) {
    var names = [];
    var paths = [];
    for (var name in soundMap) {
        var path = soundMap[name];
        names.push(name);
        paths.push(path);
    }
    let bufferLoader = new BufferLoader(context, paths, function(bufferList) {
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
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

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
                if (++loader.loadCount == loader.urlList.length) {
                    loader.onload(loader.bufferList);
                }
            }
        );
    };

    request.onerror = function() {
        alert('BufferLoader: XHR error');
    };
    request.send();
};

BufferLoader.prototype.load = function() {
    for (var i = 0; i < this.urlList.length; ++i)
        this.loadBuffer(this.urlList[i], i);
};

/**
 * Spectrogram class
 * sets up most of the configuration for the sound analysis
 * and then loads the sound using loadSounds.
 * Once finished loading, the setupVisual callback is called.
 * @param {String} filename - takes a filename
 * @param {String} selector - id to use to figure out where to display
 * @param {Object} options - Options default is {}
 */
function Spectrogram(filename, selector, options = {}) {
    this.options = options;

    var SMOOTHING = 0.0;
    var FFT_SIZE = 2048;

    // this.sampleRate = 256;
    this.sampleRate = options.sampleSize || 512;
    this.decRange = [-80.0, 80.0];

    this.width = options.width || 900;
    this.height = options.height || 440;
    this.margin = options.margin || {
        top: 20,
        right: 20,
        bottom: 30,
        left: 50
    };

    this.colorScheme = options.colorScheme || ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'];

    this.selector = selector;
    this.filename = filename;

    this.context = new(window.AudioContext || window.webkitAudioContext)();

    // setup a analyzer
    this.analyser = this.context.createAnalyser();
    this.analyser.minDecibels = this.decRange[0];
    this.analyser.maxDecibels = this.decRange[1];
    this.analyser.smoothingTimeConstant = SMOOTHING;
    this.analyser.fftSize = FFT_SIZE;

    // mute the sound
    this.volume = this.context.createGain();
    this.volume.gain.value = 0;

    // Create a ScriptProcessorNode with a bufferSize of this.sampleRate and a single input and output channel
    this.scriptNode = this.context.createScriptProcessor(this.sampleRate, 1, 1);

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

/**
 * Spectrogram.prototype.process
 * callback executed each onaudioprocess of the scriptNode
 * performs the work of analyzing the sound and storing the results
 * in a big array (not a great idea, but I haven't thought of something better
 */
Spectrogram.prototype.process = function() {
    if (this.isPlaying && !this.isLoaded) {
        this.count += 1;
        this.curSec = (this.sampleRate * this.count) / this.buffer.sampleRate;
        this.analyser.getByteFrequencyData(this.freqs);

        var d = {
            'key': this.curSec,
            'values': new Uint8Array(this.freqs)
        };
        this.data.push(d);

        if (this.count >= this.maxCount) {
            this.draw();
            this.switchButtonText();
            this.togglePlayback();
            this.isLoaded = true;
            // console.log(this.data.length);
            // console.log(this.data[0].values.length);
        }
    }
};

/**
 * Setup the visual component
 * callback executed when the sound has been loaded.
 * sets up scales and other components needed to visualize.
 */
Spectrogram.prototype.setupVisual = function() {
    // console.log(this.context.sampleRate);
    let that = this;
    // can configure these from the options
    this.timeRange = [0, this.buffer.duration];
    let maxFrequency = this.options.maxFrequency || this.getBinFrequency(this.analyser.frequencyBinCount / 2);
    let minFrequency = this.options.minFrequency || this.getBinFrequency(0);
    this.freqRange = [minFrequency, maxFrequency];

    // zoom the x-axis and the scale of the canvas
    this.zoom = d3.zoom()
        .scaleExtent([1, 4])
        .translateExtent([
            [0, 0],
            [this.width, this.height]
        ])
        .extent([
            [0, 0],
            [this.width, this.height]
        ]).on('zoom', function() {
            that.xScale = d3.event.transform.rescaleX(that.orgXScale);
            that.gX.call(that.xAxis.scale(that.xScale));
            that.draw();
        });

    this.svg = d3.select(this.selector)
        .append('svg')
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

    // loading spinner
    this.spinner = this.svg.append('g')
        .attr('transform', 'translate(' + (this.width / 2) + ',' + (this.height / 2) + ')')
        .html('<path opacity="0.2" fill="#000" d="M20.201,5.169c-8.254,0-14.946,6.692-14.946,14.946c0,8.255,6.692,14.946,14.946,14.946   s14.946-6.691,14.946-14.946C35.146,11.861,28.455,5.169,20.201,5.169z M20.201,31.749c-6.425,0-11.634-5.208-11.634-11.634   c0-6.425,5.209-11.634,11.634-11.634c6.425,0,11.633,5.209,11.633,11.634C31.834,26.541,26.626,31.749,20.201,31.749z"/> <path fill="#000" d="M26.013,10.047l1.654-2.866c-2.198-1.272-4.743-2.012-7.466-2.012h0v3.312h0   C22.32,8.481,24.301,9.057,26.013,10.047z"> <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.5s" repeatCount="indefinite"/></path>');

    this.canvas = d3.select(this.selector)
        .append('canvas')
        .attr('class', 'vis_canvas')
        .attr('width', this.width)
        .attr('height', this.height + this.margin.top)
        .style('padding', d3.map(this.margin).values().join('px ') + 'px')
        .call(this.zoom);

    this.progressLine = this.svg.append('line');

    this.button = d3.select(this.selector)
        .append('button')
        .style('margin-top', this.height + this.margin.top + this.margin.bottom + 20 + 'px')
        .text('play')
        .on('click', function() {
            that.togglePlayback();
        });

    var freqs = [];
    for (let i = 64; i < this.analyser.frequencyBinCount; i += 64) {
        freqs.push(this.getBinFrequency(i).toFixed(4));
    }

    this.freqSelect = d3.select(this.selector)
        .append('select')
        .style('margin-top', this.height + this.margin.top + this.margin.bottom + 20 + 'px')
        .style('margin-left', '20px')
        .on('change', function() {
            var newFreq = this.options[this.selectedIndex].value;
            // console.log(newFreq);
            that.yScale.domain([0, newFreq]);
            that.draw();
        });

    this.freqSelect.selectAll('option')
        .data(freqs)
        .enter()
        .append('option')
        .attr('value', function(d) {
            return d;
        })
        .attr('selected', function(d) {
            return (d == 12000) ? 'selected' : null;
        })
        .text(function(d) {
            return Math.round(d / 1000) + 'k';
        });

    this.maxCount = (this.context.sampleRate / this.sampleRate) * this.buffer.duration;

    // original x scale
    this.orgXScale = d3.scaleLinear()
        .domain(this.timeRange)
        .range([0, this.width]);

    // needed for the zoom function
    this.xScale = this.orgXScale;

    this.yScale = d3.scaleLinear()
        .domain(this.freqRange)
        .range([this.height, 0]);

    this.zScale = d3.scaleQuantize()
        .domain(this.decRange)
        .range(this.colorScheme);

    var commasFormatter = d3.format(',.2f');
    this.xAxis = d3.axisBottom(this.xScale)
        .tickSize(-this.height - 15)
        .tickPadding(10)
        .tickFormat(function(d) {
            return commasFormatter(d) + 's';
        });

    this.yAxis = d3.axisLeft(this.yScale)
        .tickSize(-this.width - 10, 0, 0)
        .tickPadding(10)
        .tickFormat(function(d) {
            return Math.round(d / 1000) + 'k';
        });

    this.gX = this.svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (this.height) + ')')
        .call(this.xAxis);

    this.svg.append('g')
        .attr('class', 'y axis')
        // .attr('transform', 'translate(0,0)')
        .call(this.yAxis);

    this.togglePlayback();
};

/**
 * Callback to show the progress
 */
Spectrogram.prototype.showProgress = function() {
    if (this.isPlaying && this.isLoaded) {
        this.curDuration = (this.context.currentTime - this.startTime);
        // this.count += 1;
        // this.curSec = (this.sampleRate * this.count) / this.buffer.sampleRate;
        var that = this;
        this.progressLine
            .attr('x1', function() {
                return that.xScale(that.curDuration);
            })
            .attr('x2', function() {
                return that.xScale(that.curDuration);
            })
            .attr('y1', 0)
            .attr('y2', this.height)
            .attr('stroke', 'red')
            .attr('stroke-width', 2.0);

        window.requestAnimFrame(this.showProgress.bind(this));

        if (this.curDuration >= this.buffer.duration) {
            this.progressLine.attr('y2', 0);
            this.togglePlayback();
        }
    }
};


/**
 * Little helper function to change the text on the button
 * after the sound has been analyzed.
 */
Spectrogram.prototype.switchButtonText = function() {
    this.button.text('play');
};

/**
 * Toggle playback
 */
Spectrogram.prototype.togglePlayback = function() {
    if (this.isPlaying) {
        this.source.stop(0);
        this.startOffset += this.context.currentTime - this.startTime;
        // console.log('paused at', this.startOffset);
        this.button.attr('disabled', null);
    } else {
        this.button.attr('disabled', true);
        this.startTime = this.context.currentTime;
        this.count = 0;
        this.curSec = 0;
        this.curDuration = 0;

        // create a buffer source node
        this.source = this.context.createBufferSource();
        this.source.buffer = this.buffer;
        this.analyser.buffer = this.buffer;
        this.scriptNode.onaudioprocess = this.process.bind(this);

        // Connect graph
        // connect to destination, else it isn't called
        this.source.connect(this.analyser);
        this.analyser.connect(this.scriptNode);

        this.analyser.connect(this.volume);
        this.volume.connect(this.context.destination);

        // this.source.connect(this.context.destination);
        this.scriptNode.connect(this.context.destination);

        this.source.loop = false;
        this.source.start(0, this.startOffset % this.buffer.duration);

        // console.log('started at', this.startOffset);

        if (this.isLoaded) {
            this.volume.gain.value = 1;
            window.requestAnimFrame(this.showProgress.bind(this));
        }
    }
    this.isPlaying = !this.isPlaying;
};

/**
 * Draw the spectrogram
 */
Spectrogram.prototype.draw = function() {
    var that = this;

    // remove spinner
    this.spinner.remove();

    var min = d3.min(this.data, function(d) {
        return d3.min(d.values);
    });
    var max = d3.max(this.data, function(d) {
        return d3.max(d.values);
    });
    this.zScale.domain([min + 20, max - 20]);

    let zoomScale = d3.zoomTransform(this.canvas.node()).k;
    this.dotWidth = (this.width / this.maxCount) * zoomScale;
    this.dotHeight = this.height / this.analyser.frequencyBinCount;

    // get the context from the canvas to draw on
    var visContext = d3.select(this.selector)
        .select('.vis_canvas')
        .node()
        .getContext('2d');

    this.svg.select('.x.axis').call(this.xAxis);
    this.svg.select('.y.axis').call(this.yAxis);

    visContext.clearRect(0, 0, this.width + this.margin.left, this.height);

    // display as canvas here.
    this.data.forEach(function(d) {
        for (var i = 0; i < d.values.length - 1; i++) {
            // draw each pixel with the specific color
            var v = d.values[i];
            var x = that.xScale(d.key);
            var y = that.yScale(that.getBinFrequency(i));
            // color scale
            visContext.fillStyle = that.zScale(v);
            // draw the line
            visContext.fillRect(x, y, that.dotWidth, that.dotHeight);
        }
    });
};

/**
 * Get the frequency value
 */
Spectrogram.prototype.getFrequencyValue = function(freq) {
    var nyquist = this.context.sampleRate / 2;
    var index = Math.round(freq / nyquist * this.freqs.length);
    return this.freqs[index];
};

/**
 * Get the frequency value
 */
Spectrogram.prototype.getBinFrequency = function(index) {
    var nyquist = this.context.sampleRate / 2;
    var freq = index / this.freqs.length * nyquist;
    return freq;
};