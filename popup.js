
var PG = {
	ApexClasses : [],
	ApexTriggers : [],
	CustomFields : [],
	tab : null,
	
	init : function(){
		chrome.tabs.query( {active:true}, function callback(tabs){
		  PG.tab = tabs[0];
		  PG.isChangeSet = PG.tab.url.indexOf('changemgmt/inboundChangeSetDetailPage') != -1;
		  PG.isUnmanagedPackage = PG.tab.url.indexOf('/033') != -1;
		});
	},

	clicked : function (e){
	    chrome.tabs.sendMessage(
			PG.tab.id,
			{'request':'GET'}, 
			function(response){
				document.getElementById('output').innerHTML = JSON.stringify(response.json);
				
				if( PG.isUnmanagedPackage ){
					PG.extractComponentsFromUnmanagedPackage(response);
				}else if( PG.isChangeSet ){
					PG.extractComponentsFromChangeSet(response);
				}
			}
		);
	},
	
	extractComponentsFromChangeSet : function (response){
		if( response.json.TBODY != undefined && response.json.TBODY.TR != undefined){
			for(var i=0; i < response.json.TBODY.TR.length; i++ ){
				var tr = response.json.TBODY.TR[i];
				var type = tr.TD[3];
				if( type['text'] == 'Custom Field' ){
					var name = tr.TD[4].text;
					PG.CustomFields.push( '<members>' + name + '</members>' );
				}else if( type['text'] == 'Apex Class' ){
					var name = tr.TD[4].text;
					PG.ApexClasses.push( '<members>' + name + '</members>' );
				}else if( type['text'] == 'Apex Trigger' ){
					var name = tr.TD[4].text;
					PG.ApexTriggers.push( '<members>' + name + '</members>' );
				}
			}
			PG.generatePackage();
		}
	},
	
	extractComponentsFromUnmanagedPackage : function (response){
		if( response.json.TBODY != undefined && response.json.TBODY.TR != undefined){
			for(var i=0; i < response.json.TBODY.TR.length; i++ ){
				var tr = response.json.TBODY.TR[i];
				var type = tr.TD[4];
				if( type['text'] == 'Custom Field' ){
					var name = tr.TD[2].A.text;
				}else if( type['text'] == 'Apex Class' ){
					var name = tr.TD[2].A.text;
					PG.ApexClasses.push( '<members>' + name + '</members>' );
				}else if( type['text'] == 'Apex Trigger' ){
					var name = tr.TD[2].A.text;
					PG.ApexTriggers.push( '<members>' + name + '</members>' );
				}
			}
			PG.generatePackage();
		}
	},
	
	/* Generic for all pages */
	generatePackage : function (){
		var package = '';
		if( document.getElementById('withVersion').checked ){
			package += '<?xml version="1.0" encoding="UTF-8"?>\n';
			package += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
		}
		if( PG.ApexClasses.length > 0 ){
			package += '<type>\n';
			for( var i = 0; i < PG.ApexClasses.length; i++){
				package += '\t' + PG.ApexClasses[i] + '\n';
			}
			package += '\t<name>ApexClass</name>\n';
			package += '</type>\n';
		}
		
		if( PG.ApexTriggers.length > 0 ){
			package += '<type>\n';
			for( var i = 0; i < PG.ApexTriggers.length; i++){
				package += '\t' + PG.ApexTriggers[i] + '\n';
			}
			package += '\t<name>ApexTrigger</name>\n';
			package += '</type>\n';
		}
		
		if( PG.CustomFields.length > 0 ){
			package += '<type>\n';
			for( var i = 0; i < PG.CustomFields.length; i++){
				package += '\t' + PG.CustomFields[i] + '\n';
			}
			package += '\t<name>CustomField</name>\n';
			package += '</type>\n';
		}
		
		if( document.getElementById('withVersion').checked ){
			package += '<version>30.0</version>\n';
			package += '</package>';
		}
		document.getElementById('output').value = package;
		console.log( package );
	}

}


document.addEventListener('DOMContentLoaded', function () {
  PG.init();

  var divs = document.querySelectorAll('button');
  for (var i = 0; i < divs.length; i++) {
    divs[i].addEventListener('click', PG.clicked);
  }
});