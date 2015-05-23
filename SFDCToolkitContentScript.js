window.setTimeout(function(){
	getPackage();
	goToUserDetailPageDirectly();
	putButtonOnDevConsole();
}, 500);

function putButtonOnDevConsole(){
	if(window.location.href.indexOf( 'apex/debug/ApexCSIPage' ) != -1 ){
		
		//add magic button
		window.setTimeout(function(){
			var left = $('#forwardButton').css('left');
			var r= $('<input id="MagicButton" type="button" value="Export Records" title="click to export data in CSV. -By SFDC Magic Toolkit"/>').
						css({
							'z-index': 1000,
							'top' : '0px',
							'left': left,
							'position' : 'relative',
							'margin-left' : '20px'
						})
						.insertAfter("#forwardButton")
						.click(function(){
							EXP.init();
						});
		}, 8000 );	
	}
}

function goToUserDetailPageDirectly(){
	
	$("a[href*='/005']")
	.each(function(){
		if (this.href.indexOf("?noredirect=1") == -1){
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
		sendResponse({'status': 'failed', 'json':'Please navigate to inbound/Outbound changeset and try again. If problem persists then contact bhupendrasyadav@gmail.com'});
		return;
	}

	json = xmlToJson(table);
	var a = $('a[id$="nextPageLink"]');
	
	if( a.length == 0 ){
		sendResponse({'status': 'done', 'json':json});
	}else
		sendResponse({'status': 'In Progress', 'json':json});
	
	if( a.length != 0 ){
		a[0].click();
	}
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

var Exporter = EXP = {
	Columns : '',
	isFirst : true,
	init : function(){
		var rawDataHTML = document.evaluate("//div[@id='editors-body']/div[not(contains(@style,'display:none') or contains(@style,'display: none'))]",document,null,0,null);
		EXP.Columns = '';
		EXP.isFirst = true;
		
		$.each($( rawDataHTML.iterateNext() ).find( ".x-column-header-text" ), function (index, value){
			if(EXP.isFirst){
				EXP.Columns += '"' + value.innerText + '"' ;
				EXP.isFirst = false;
			}
			else{
				EXP.Columns += ',"' + value.innerText + '"' ; 
			}
		});
		console.log(EXP.Columns);
		
		var csv = EXP.Columns + '\r\n';
		var fileName = $($(".x-tab-default-top-active")[0]).find(".x-tab-inner")[0].innerText;
		var o = document.evaluate("//div[@id='editors-body']/div[not(contains(@style,'display:none') or contains(@style,'display: none'))]//table/tbody/tr",document,null,0,null);
		console.log(o);
		
		var r = [];
		while(row = o.iterateNext()){	
			var cols = row.getElementsByTagName('td');
			var a = [];
			for(var i=0; i<cols.length; i++){
				if(cols[i].textContent === " "){
					a.push( FormatForCSV("") );
				}
				else{
					a.push( EXP.FormatForCSV( cols[i].textContent ) );
				}
			}
			r.push( a );
		}
		
		// generating csv file
		var rows = [];
		var query = '';
		for(var i=0; i<r.length; i++){
			rows.push( r[i].join(",") );
		}
		rows.splice(0, 1);
		rows.splice(0, 1);
		csv += rows.join('\r\n');

		EXP.OpenInNewWindow(csv,fileName);
	},
	FormatForCSV : function (input) {
		// replace " with “
		var regexp = new RegExp(/["]/g);
		var output = input.replace(regexp, "“");
		//HTML
		var regexp = new RegExp(/\<[^\<]+\>/g);
		var output = output.replace(regexp, "");
		if (output == "" || output.trim() == "") return '';
		return '"' + output + '"';
	},

	// showing data in window for copy/ paste
	OpenInNewWindow: function (data ,fileName) {
		var generator = window.open('', 'SFDC Magic Tool', 'height=400,width=600');
		generator.document.write('<html><head><title>SFDC Magic Tool</title>');
		generator.document.write('</head><body style="overflow: hidden;">');
		generator.document.write('Copy-Paste below CSV data or  <a href="'+encodeURI("data:text/csv;charset=utf-8," + data)+'" download="'+fileName+'.csv">click to Download</a> file.<br>');
		generator.document.write('<textArea style="width: 100%; height: 94%; background-color:#ffffff;margin-top: 5px;" wrap="off">');
		generator.document.write(data);
		generator.document.write('</textArea>');
		generator.document.write('</body></html>');
		generator.document.close();
		return true;
	}
}