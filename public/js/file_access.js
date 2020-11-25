

function getUserAudioFiles(func){
    $.post({
        url: "\\getfilelist", 
        success: function(result){
          
          func(result.data)
          // console.log(result.data[0]['audio_location'])
          // play("file?file=" + result.data[0]['audio_location'])        
        }
    });
};

$('#uploadForm').on('sumbit', function(){
  var form = $(this);
  var formdata = false;
  if (window.FormData){
      formdata = new FormData(form[0]);
  }
  var formAction = form.attr('action');
  $.ajax({
      url: '/upload_audio',
      type: 'POST',
      cache: false,
      processData: false,
      contentType : false,
      data: $('#uploadForm').serialize(),
      success: function(){
          console.log("file uploaded successfully");
          alert("file uploaded successfully");
      },
      error: function(result){
        alert("file failed to upload");
        console.log(result);
      }
  });
});
  
function play(url) {
    var audio = new Audio(url);
    audio.play();
};