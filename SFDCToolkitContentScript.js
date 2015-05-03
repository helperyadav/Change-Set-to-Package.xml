window.setTimeout(function(){
	getPackage();
	goToUserDetailPageDirectly();
}, 500);

function goToUserDetailPageDirectly(){
	
	$("a[href*='/005']")
	.each(function()
	{
		
		if (this.href.indexOf("?noredirect=1") == -1)
		{
			if(this.href.indexOf("?") == -1)
				this.href = this.href + "?noredirect=1";
			else 
				this.href = this.href + "&noredirect=1";
		}
	});
	
}

function getPackage(){
  
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	console.log('mssg: ' + message.param);
	var URL = document.location.href;
	
	if( URL.indexOf('/033') != -1 ){
		table = document.getElementsByClassName('list')[0];
	}else if( URL.indexOf('changemgmt/inboundChangeSetDetailPage') != -1 ){
		table = $('table[id$="component_list_table"]').get(0);
	}else if( URL.indexOf('changemgmt/outboundChangeSetDetailPage') != -1 ){
		table = $('table[id$="OutboundChangeSetComponentList"]').get(0);
	}else{
		sendResponse({'json':'Something went wrong. Try again after reloading the page. If problem persists then contact bhupendrasyadav@gmail.com'});
		return;
	}

	json = xmlToJson(table);
	sendResponse({'json':json});
	//$('a[id$="nextPageLink"]').click();
  });
}




function isBlank(obj){
    return (obj.replace(/[\s\n]*/g , '').length == 0);
}

// Changes XML to JSON
function xmlToJson(xml) {
	// Create the return object
	var obj = {};

	if (xml.nodeType == 1) { // element
		// do attributes
		if (xml.attributes.length > 0) {
		obj["attributes"] = {};
			for (var j = 0; j < xml.attributes.length; j++) {
				var attribute = xml.attributes.item(j);
				if( !isBlank(attribute.nodeValue) )
					obj["attributes"][attribute.nodeName] = attribute.nodeValue;
			}
		}
	} else if (xml.nodeType == 3 && !isBlank( xml.nodeValue) ) { // text
		obj = xml.nodeValue;
	}

	// do children
	if (xml.hasChildNodes()) {
		for(var i = 0; i < xml.childNodes.length; i++) {
			var item = xml.childNodes.item(i);
			var nodeName = item.nodeName.replace('#','');
			if (typeof(obj[nodeName]) == "undefined") {
				var val = xmlToJson(item);
				obj[nodeName] = val;
			} else {
				if (typeof(obj[nodeName].push) == "undefined") {
					var old = obj[nodeName];
					obj[nodeName] = [];
					obj[nodeName].push(old);
				}
				var v = xmlToJson(item);
				obj[nodeName].push(v);
			}
		}
	}
	return obj;
}

