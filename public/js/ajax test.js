$(document).ready(function(){
  $(":button").click(function(){
    $.post({
      url: "\\getfilelist", 
      success: function(result){
        console.log(result)
        console.log(result.data[0])
        play("file?file=" + result.data[0])        
      }
    });
  });
});


function play(url) {
  var audio = new Audio(url);
  audio.play();
}