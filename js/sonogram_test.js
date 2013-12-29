var context;
var source, sourceJs;
var analyser;
var buffer;
// var url = 'data/cufool_you_in_my_world_instrumental.ogg';
var url = 'data/bird.mp3';
var freqDomainByte = new Array();
var freqDomain = new Array();
var boost = 0;

var interval = window.setInterval(function() {
	if($('#loading_dots').text().length < 3) {
		$('#loading_dots').text($('#loading_dots').text() + '.');
	}
	else {
		$('#loading_dots').text('');
	}
}, 500);

try {
	if(typeof webkitAudioContext === 'function') {
		context = new webkitAudioContext();
	}
	else {
		context = new AudioContext();
	}
}
catch(e) {
	$('#info').text('Web Audio API is not supported in this browser');
}
var request = new XMLHttpRequest();
request.open("GET", url, true);
request.responseType = "arraybuffer";

request.onload = function() {
	context.decodeAudioData(request.response, function(buffer) {
    if(!buffer) {
      $('#info').text('Error decoding file data');
      return;
    }
			
    sourceJs = context.createJavaScriptNode(2048);
    sourceJs.buffer = buffer;
    sourceJs.connect(context.destination);
    analyser = context.createAnalyser();
    analyser.smoothingTimeConstant = 0.2;
    analyser.fftSize = 512;

    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = false;

    source.connect(analyser);
    analyser.connect(sourceJs);
    source.connect(context.destination);

    sourceJs.onaudioprocess = function(e) {
      // console.log(context.currentTime);
      freqDomainByte = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqDomainByte);

      var freqDomain = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(freqDomain);
      
      boost = 0;
      for (var i = 0; i < freqDomainByte.length; i++) {
        boost += freqDomainByte[i];
      }
      boost = boost / freqDomainByte.length;
    };

    $('#info')
      .fadeOut('normal', function() {
        $(this).html('');
      })
    .fadeIn();

    clearInterval(interval);

    console.log('append');
    // popup
    $('body').append($('<div onclick="play();" id="play" style="width: ' + 300 + 'px; height: ' + 300 + 'px;"><div id="play_link">Play</div></div>'));
    $('#play').fadeIn();
  },
    function(error) {
      $('#info').text('Decoding error:' + error);
    }
  );
};

request.onerror = function() {
  console.log('error');
  $('#info').text('buffer: XHR error');
};

request.send();

function displayTime(time) {
  if(time < 60) {
    return '0:' + (time < 10 ? '0' + time : time);
  }
  else {
    var minutes = Math.floor(time / 60);
    time -= minutes * 60;
    return minutes + ':' + (time < 10 ? '0' + time : time);
  }
}

function play() {
  $('#play').fadeOut('normal', function() {
    $(this).remove();
  });
  source.noteOn(0);
}

function getFrequencyValue(frequency) {
  var nyquist = context.sampleRate/2;
  var index = Math.round(frequency/nyquist * freqDomain.length);
  return freqDomain[index];
}


$(window).resize(function() {
  if($('#play').length === 1) {
    $('#play').width($(window).width());
    $('#play').height($(window).height());

    if($('#play_link').length === 1) {
      $('#play_link').css('top', ($(window).height() / 2 - $('#play_link').height() / 2) + 'px');
      $('#play_link').css('left', ($(window).width() / 2 - $('#play_link').width() / 2) + 'px');
    }
  }
});

