$(document).ready(function(){
    $(":button").click(function(){

      });
    });
  });
  

function getUserAudioFiles(){
    $.post({
        url: "\\getfilelist", 
        success: function(result){
          console.log(result)
          console.log(result.data[0]['audio_location'])
          play("file?file=" + result.data[0]['audio_location'])        
        }
    });
}
  
function play(url) {
    var audio = new Audio(url);
    audio.play();
}