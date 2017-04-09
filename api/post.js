
var v = require('./visiting');

//rest api post 수신 (from json to json)

exports.doAction = function (req, res) {

	console.log("doAction start");
	
	actionProcess(req.body).then(data => {
		    return res.json(data);
		  }).catch(err => {
		    return res.status(err.code || 500).json(err);
	});

};

let actionProcess = (response) => {
	 
	  return new Promise((resolved, rejected) => {
	    // Send the input to the conversation service
		  
		  let processed = postProcess(response);
	        if(processed){
	          // return 값이 Promise 일 경우
	          if(typeof processed.then === 'function'){
	            processed.then(response => {
	              resolved(response);
	            }).catch(err => {
	              rejected(err);
	            })
	          }
	          // return 값이 변경된 data일 경우
	          else{
	            resolved(processed);
	          }
	        }
	        else{
	          // return 값이 없을 경우
	          resolved(response);
	        }
	  })
}

let postProcess = response => { 
	  console.log("Conversation Output : " + response.output.text);
	  console.log("--------------------------------------------------");
	  if(response.context && response.context.action){
	    return v.doAction(response, response.context.action);
	  }  
}
	 
 
