# SpectrogramJS

Visualize sounds as a spectrogram - right in your browser!

![Spectrogram](http://vallandingham.me/spectrogramJS/example.png)

## Usage 

Include the css for .spectrogram elements

    <link href="css/spectrogram.css" media="screen" rel="stylesheet" type="text/css" />

SpectrogramJS depends on jquery and D3.js - so make sure you include them first..


    <script type="text/javascript" src="js/jquery-2.0.3.min.js"></script>
    <script type="text/javascript" src="js/d3.v3.min.js"></script>


Then source spectrogram.js


    <script type="text/javascript" src="js/spectrogram.js"></script>

To create a new spectrogram, create a new instance of Spectrogram and pass in the audio file to analyze, the selector id where to display the visual, and any options you would like to set.

For example, if I had a div with an id of "vis" in my html:

    <div id="vis" class="spectrogram"></div>

I would add a spectrogram there by using:

      var sample = new Spectrogram('data/bird_short.ogg', "#vis", {width:500, height:200, maxFrequency:8000});

## Options

Currently, the defaults of a Spectrogram are changed by passing in an object of options. This might change to a more chainable API.

But for now, there are a few things you can change:

    width: width in pixels of the spectrogram.

    height: height in pixels of the spectrogram.

    sampleSize: Number of samples to analyze frequencies of. Suggested: 512, or 256. A smaller number means more sampling, which means better resolution but a slower visual display.

    maxFrequency: The maximum frequency to display initially. 

    minFrequency: The minimum frequency to display.
