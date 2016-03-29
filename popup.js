var PG = {
	ApexClasses : {},
	ApexTriggers : {},
	CustomFields : {},
	Groups :{},
	CustomSettings : {},
	ApexPages : {},
	workflowrules : {},
	workflowfieldupdates : {},
	WorkflowEmailAlert: {},
	pagelayouts : {},
	queues : {},
	StaticResource:{},
	ValidationRule : {},
	HomePageComponent :{},
	HomePageLayout: {},
	CustomTab:{},
	Flow:{},
	WebLink:{},
	ApprovalProcess:{},
	ListView:{},
	EmailTemplate:{},
	
	tab : null,
	baseURL : null,
	session : null,
	toolingservice:{
		'customField': '/services/data/v28.0/tooling/sobjects/CustomField',
		'workflowrule' : '/services/data/v30.0/tooling/sobjects/workflowrule',
		'workflowfieldupdate': '/services/data/v32.0/tooling/sobjects/workflowfieldupdate',
		'coverage' : '/services/data/v29.0/tooling/query/?q=SELECT+Coverage+FROM+ApexCodeCoverageAggregate',
		'validationRule':'/services/data/v31.0/tooling/query?q=select+ValidationName,+Fullname+from+ValidationRule+where+validationName='
	},

	init : function(){
		chrome.tabs.query( {active:true}, function callback(tabs){
		  PG.tab = tabs[0];
		  PG.baseURL = PG.tab.url.substr( 0, PG.tab.url.indexOf('.com/') + 4 );
		  PG.isInboundChangeSet = PG.tab.url.indexOf('changemgmt/inboundChangeSetDetailPage') != -1;
		  PG.isOutboundChangeSet = PG.tab.url.indexOf('changemgmt/outboundChangeSetDetailPage') != -1;
		  PG.isUnmanagedPackage = PG.tab.url.indexOf('/033') != -1;
		  PG.isSalesforceSite = PG.tab.url.indexOf('salesforce.com') != -1;
		  PG.sessionId = PG.getSessionId();
		});
	},
	
	resetVariables : function(){
		PG.HomePageLayout = {};
		PG.HomePageComponent = {};
		PG.ValidationRule = {};
		PG.StaticResource = {};
		PG.ApexClasses = {};
		PG.ApexTriggers = {};
		PG.CustomFields =  {};
		PG.Groups =  {};
		PG.CustomSettings  =  {};
		PG.ApexPages  =  {};
		PG.workflowrules =  {};
		PG.workflowfieldupdates =  {};
		PG.WorkflowEmailAlert = {};
		PG.EmailTemplate = {};
		PG.ListView={};
		PG.ApprovalProcess={};
		PG.CustomTab = {};
		PG.Flow = {};
		PG.WebLink = {};
		PG.pagelayouts =  {};
		PG.queues = {};
	},
	
	packageHandler: function(e){
		if(!PG.isSalesforceSite){
			document.getElementById('output').value = 'Please navigate to inbound/outbound ChangeSet page to generate package.xml';
			return;
		}
		PG.resetVariables();
		if(PG.isOutboundChangeSet){
			//try to use MetaData wsdl, fallback on exception.
			try{
				document.getElementById('loading').style.display = 'inline-block';
			
				chrome.tabs.sendMessage(
					PG.tab.id,
					{'request':'GET_CS_NAME'}, 
					function(response){
						if( response === undefined || response.status == 'failed' ){
								document.getElementById('output').value = response.json || 'Something went wrong. Try again after reloading the page. If problem persists then contact bhupendrasyadav@gmail.com';
								document.getElementById('loading').style.display = 'none';
								return;
						}
						
						if(response.status == 'done'){
							MetaData.retrieve(response.csName);
						}else{
							PG.handleGetPackage(e);
						}
				});
			}catch(ex){
				PG.handleGetPackage(e);
			}
			
		}else{
			PG.handleGetPackage(e);
		}
	},
	
	handleGetPackage : function (e){
		document.getElementById('loading').style.display = 'inline-block';
		
		chrome.tabs.sendMessage(
			PG.tab.id,
			{'request':'GET'}, 
			function(response){
				if( response === undefined || response.status == 'failed' ){
						document.getElementById('output').value = response.json || 'Something went wrong. Try again after reloading the page. If problem persists then contact bhupendrasyadav@gmail.com';
						document.getElementById('loading').style.display = 'none';
						return;
				}
				
				if( PG.isUnmanagedPackage ){
					PG.extractComponentsFromUnmanagedPackage(response);
				}else if( PG.isInboundChangeSet ){
					PG.extractComponentsFromInboundChangeSet(response);
				}else if( PG.isOutboundChangeSet ){
					PG.extractComponentsFromOutboundChangeSet(response);
				}
				
				if(response.status == 'In Progress'){
					window.setTimeout(function(){
						PG.handleGetPackage();
					}, 5000);
				}else {
					document.getElementById('loading').style.display = 'none';
				}
			}
		);
	},
	
	extractComponentsFromInboundChangeSet : function (response){
		PG.extractComponentsFromOutboundChangeSet(response);
	},
	/* 					Outbound changeset */
	extractComponentsFromOutboundChangeSet : function (response){
		var xhrCounter = 0;
		if( response.json.TBODY != undefined && response.json.TBODY.TR != undefined){
			for(var i=0; i < response.json.TBODY.TR.length; i++ ){
				var tr = response.json.TBODY.TR[i];
				var type = tr.TD[3];
				if( type['text'] == 'Custom Field' ){
					// change set was uploaded. Hence easy to get API names.
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.CustomFields[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>';
					}else{
						xhrCounter++;
						var toolingcustomfield = PG.baseURL + PG.toolingservice.customField + tr.TD[1].A.attributes.href;
						
						var xhr = new XMLHttpRequest();
						xhr.open("GET", toolingcustomfield , true);
						xhr.setRequestHeader("Content-type","application/json");
						xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
						xhr.onreadystatechange = function(x) {
							if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
								var apiName = JSON.parse(x.currentTarget.responseText).FullName;
								//console.log( apiName );
								PG.CustomFields[apiName] =  '<members>' + apiName + '</members>' ;
								
								xhrCounter--;
								if( xhrCounter == 0 )
									PG.generatePackage();
							}
						}
						xhr.send();
					}
					
				}else if( type['text'] == 'Apex Class' ){
					var name = tr.TD[4].text;
					PG.ApexClasses[name] = '<members>' + name + '</members>' ;
				}else if( type['text'] == 'Apex Trigger' ){
					var name = tr.TD[4].text;
					PG.ApexTriggers[name] = '<members>' + name + '</members>' ;
				}else if( type['text'] == 'Group' ){
					var name = tr.TD[4].text;
					PG.Groups[name] = '<members>' + name + '</members>' ;
				}else if( type['text'] == 'Custom Setting' || type['text'] == 'Custom Object' || type['text'] == 'Custom Setting Definition'){
					var name = tr.TD[4].text;
					PG.CustomSettings[name] = '<members>' + name + ( name.match(/__c$/) ? '' : '__c') + '</members>' ;
				}else if( type['text'] == 'Visualforce Page' ){
					var name = tr.TD[4].text;
					PG.ApexPages[name] = '<members>' + name + '</members>';
				}else if( type['text'] == 'Page Layout' ){
					var name = tr.TD[4].text;
					PG.pagelayouts[name] = '<members>' + name + '</members>' ;
				}else if( type['text'] == 'Queue' ){
					var name = tr.TD[4].text;
					PG.queues[name] = '<members>' + name + '</members>' ;
				}else if( type['text'] == 'Workflow Rule' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.workflowrules[tr.TD[4].text] =  '<members>' + tr.TD[4].text + '</members>' ;
					}else{
						xhrCounter++;
						var toolingcustomfield = PG.baseURL + PG.toolingservice.workflowrule + tr.TD[1].A.attributes.href;
						
						var xhr = new XMLHttpRequest();
						xhr.open("GET", toolingcustomfield , true);
						xhr.setRequestHeader("Content-type","application/json");
						xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
						xhr.onreadystatechange = function(x) {
							if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
								var apiName = JSON.parse(x.currentTarget.responseText).FullName;
								//console.log( apiName );
								PG.workflowrules[apiName] = '<members>' + apiName + '</members>' ;
								
								xhrCounter--;
								if( xhrCounter == 0 )
									PG.generatePackage();
							}
						}
						xhr.send();
					}
				}else if( type['text'] == 'Workflow Field Update' ){
			
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.workflowfieldupdates[ tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>';
					}else{
						xhrCounter++;
						var toolingcustomfield = PG.baseURL + PG.toolingservice.workflowfieldupdate + tr.TD[1].A.attributes.href;
						
						var xhr = new XMLHttpRequest();
						xhr.open("GET", toolingcustomfield , true);
						xhr.setRequestHeader("Content-type","application/json");
						xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
						xhr.onreadystatechange = function(x) {
							if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
								var apiName = JSON.parse(x.currentTarget.responseText).FullName;
								//console.log( apiName );
								PG.workflowfieldupdates[apiName] =  '<members>' + apiName + '</members>';
								
								xhrCounter--;
								if( xhrCounter == 0 )
									PG.generatePackage();
							}
						}
						xhr.send();
					}
				}else if( type['text'] == 'Workflow Email Alert' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.WorkflowEmailAlert[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>' ;
					}
					
				}else if( type['text'] == 'Email Template' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.EmailTemplate[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>' ;
					}
					
				}else if( type['text'] == 'List View' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.ListView[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>' ;
					}
					
				}else if( type['text'] == 'Approval Process' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.ApprovalProcess[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>' ;
					}
					
				}else if( type['text'] == 'Button or Link' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.WebLink[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>' ;
					}
					
				}else if( type['text'] == 'Flow Version' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.Flow[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>' ;
					}
					
				}else if( type['text'] == 'Tab' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.CustomTab[tr.TD[4].text] = '<members>' + tr.TD[4].text + '</members>' ;
					}
					
				}else if( type['text'] == 'Static Resource' ){
					var name = tr.TD[4].text;
					PG.StaticResource[name] = '<members>' + name + '</members>';
				}else if(type['text'] == 'Validation Rule' ){
					if( tr.TD[0].A !== undefined && tr.TD[0].A.text.indexOf('View Source') != -1 ){
						PG.ValidationRule[tr.TD[4].text]  = '<members>' + tr.TD[4].text + '</members>';
					}else{
						xhrCounter++;
						var toolingcustomfield = PG.baseURL + PG.toolingservice.validationRule + "'" +tr.TD[4].text + "'";
						
						var xhr = new XMLHttpRequest();
						xhr.open("GET", toolingcustomfield , true);
						xhr.setRequestHeader("Content-type","application/json");
						xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
						xhr.onreadystatechange = function(x) {
							if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
								var apiName = JSON.parse(x.currentTarget.responseText).records[0].FullName;
								//console.log( apiName );
								PG.ValidationRule[apiName] =  '<members>' + apiName + '</members>';
								
								xhrCounter--;
								if( xhrCounter == 0 )
									PG.generatePackage();
							}
						}
						xhr.send();
					}
				}else if(type['text'] == 'Home Page Component'){
					var name = tr.TD[4].text;
					PG.HomePageComponent[name] = '<members>' + name + '</members>' ;
				
				}else if(type['text'] == 'Home Page Layout'){
					var name = tr.TD[4].text;
					PG.HomePageLayout[name] = '<members>' + name + '</members>' ;
				}
			}
			if( xhrCounter == 0 )
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
					PG.ApexClasses[name] =  '<members>' + name + '</members>' ;
				}else if( type['text'] == 'Apex Trigger' ){
					var name = tr.TD[2].A.text;
					PG.ApexTriggers[name] = '<members>' + name + '</members>' ;
				}
			}
			PG.generatePackage();
		}
	},
	
	/* Generic for all pages */
	generatePackage : function (){
		var package = '';
			package += '<?xml version="1.0" encoding="UTF-8"?>\n';
			package += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
		
		
		if( Object.keys(PG.HomePageLayout).length > 0 ){
			package += '<type>\n';
			for( i in PG.HomePageLayout ){
				package += '\t' + PG.HomePageLayout[i] + '\n';
			}
			package += '\t<name>HomePageLayout</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.HomePageComponent).length > 0 ){
			package += '<type>\n';
			for( i in PG.HomePageComponent ){
				package += '\t' + PG.HomePageComponent[i] + '\n';
			}
			package += '\t<name>HomePageComponent</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.StaticResource).length > 0 ){
			package += '<type>\n';
			for( i in PG.StaticResource){
				package += '\t' + PG.StaticResource[i] + '\n';
			}
			package += '\t<name>StaticResource</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.ValidationRule).length > 0 ){
			package += '<type>\n';
			for( i in PG.ValidationRule ){
				package += '\t' + PG.ValidationRule[i] + '\n';
			}
			package += '\t<name>ValidationRule</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.ApexClasses).length > 0 ){
			package += '<type>\n';
			for( i in PG.ApexClasses ){
				package += '\t' + PG.ApexClasses[i] + '\n';
			}
			package += '\t<name>ApexClass</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.ApexPages).length > 0 ){
			package += '<type>\n';
			for( i in PG.ApexPages ){
				package += '\t' + PG.ApexPages[i] + '\n';
			}
			package += '\t<name>ApexPage</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.ApexTriggers).length > 0 ){
			package += '<type>\n';
			for( i in  PG.ApexTriggers ){
				package += '\t' + PG.ApexTriggers[i] + '\n';
			}
			package += '\t<name>ApexTrigger</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.CustomFields).length > 0 ){
			package += '<type>\n';
			for( i in PG.CustomFields){
				package += '\t' + PG.CustomFields[i] + '\n';
			}
			package += '\t<name>CustomField</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.CustomSettings).length > 0 ){
			package += '<type>\n';
			for( i in PG.CustomSettings){
				package += '\t' + PG.CustomSettings[i] + '\n';
			}
			package += '\t<name>CustomObject</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.Groups).length > 0 ){
			package += '<type>\n';
			for( i in PG.Groups){
				package += '\t' + PG.Groups[i] + '\n';
			}
			package += '\t<name>Group</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.workflowrules).length > 0 ){
			package += '<type>\n';
			for( i in PG.workflowrules){
				package += '\t' + PG.workflowrules[i] + '\n';
			}
			package += '\t<name>WorkflowRule</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.workflowfieldupdates).length > 0 ){
			package += '<type>\n';
			for( i in PG.workflowfieldupdates){
				package += '\t' + PG.workflowfieldupdates[i] + '\n';
			}
			package += '\t<name>WorkflowFieldUpdate</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.WorkflowEmailAlert).length > 0 ){
			package += '<type>\n';
			for( i in PG.WorkflowEmailAlert){
				package += '\t' + PG.WorkflowEmailAlert[i] + '\n';
			}
			package += '\t<name>WorkflowEmailAlert</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.EmailTemplate).length > 0 ){
			package += '<type>\n';
			for( i in PG.EmailTemplate){
				package += '\t' + PG.EmailTemplate[i] + '\n';
			}
			package += '\t<name>EmailTemplate</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.ListView).length > 0 ){
			package += '<type>\n';
			for( i in PG.ListView){
				package += '\t' + PG.ListView[i] + '\n';
			}
			package += '\t<name>ListView</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.ApprovalProcess).length > 0 ){
			package += '<type>\n';
			for( i in PG.ApprovalProcess){
				package += '\t' + PG.ApprovalProcess[i] + '\n';
			}
			package += '\t<name>ApprovalProcess</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.WebLink).length > 0 ){
			package += '<type>\n';
			for( i in PG.WebLink){
				package += '\t' + PG.WebLink[i] + '\n';
			}
			package += '\t<name>WebLink</name>\n';
			package += '</type>\n';
		}
		if( Object.keys(PG.Flow).length > 0 ){
			package += '<type>\n';
			for( i in PG.Flow){
				package += '\t' + PG.Flow[i] + '\n';
			}
			package += '\t<name>Flow</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.CustomTab).length > 0 ){
			package += '<type>\n';
			for( i in PG.CustomTab){
				package += '\t' + PG.CustomTab[i] + '\n';
			}
			package += '\t<name>CustomTab</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.pagelayouts).length > 0 ){
			package += '<type>\n';
			for( i in PG.pagelayouts){
				package += '\t' + PG.pagelayouts[i] + '\n';
			}
			package += '\t<name>Layout</name>\n';
			package += '</type>\n';
		}
		
		if( Object.keys(PG.queues).length > 0 ){
			package += '<type>\n';
			for(i in PG.queues){
				package += '\t' + PG.queues[i] + '\n';
			}
			package += '\t<name>Queue</name>\n';
			package += '</type>\n';
		}
		
		package += '<version>35.0</version>\n';
		package += '</Package>';
		
		document.getElementById('output').value = package;
		//console.log( package );
		//document.getElementById('loading').style.display = 'none';
	},
	
	getSessionId : function(){
		 chrome.tabs.query({"status":"complete","windowId":chrome.windows.WINDOW_ID_CURRENT,"active":true}, function(tab){
				chrome.cookies.getAll({"url":tab[0].url, "name":"sid"},function (cookie){
					console.table(cookie);
					allCookieInfo = "";
					for(i=0;i<cookie.length;i++){
						if(cookie[i].name = 'sid' && cookie[i].session == true && cookie[i].secure == true){
							PG.session = cookie[i].value;
							console.log( PG.session);
						}
					}
				});
		});

	}

}

/*** Code Coverage Provider **/
var CCP = {
	clsssNamesLoaded : false,
	triggerNamesLoaded : false,
	classNames: {}, 
	triggerNames : {},
	triggerCoverage: {},
	apexclassCoverage: {},
	
	EndPoint :{
		'apexclasses': '/services/data/v29.0/query/?q=select+name,Id+from+apexclass+WHERE+NamespacePrefix+=+null',
		'apextriggeres': '/services/data/v29.0/query/?q=select+name,Id+from+apextrigger+WHERE+NamespacePrefix+=+null',
		'coverage' : '/services/data/v29.0/tooling/query/?q=SELECT+Coverage,ApexClassOrTriggerId+FROM+ApexCodeCoverageAggregate',
	},
	
	handleGetCoverage : function(e){
		if(!PG.isSalesforceSite){
			document.getElementById('output').value = 'Please navigate to salesforce to generate Code coverage.';
			return;
		}
		
		document.getElementById('loading').style.display = 'inline-block';
		if(!CCP.clsssNamesLoaded)
			CCP.loadClasses();
		if(!CCP.triggerNamesLoaded)
			CCP.loadTrigger();
		
		CCP.loadCoverage();
	},
	
	loadTrigger : function(){
		var toolingCoverageEndPoint = PG.baseURL + CCP.EndPoint.apextriggeres;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", toolingCoverageEndPoint , true);
		xhr.setRequestHeader("Content-type","application/json");
		xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
		xhr.onreadystatechange = function(x) {
			if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
				var triggerResp = JSON.parse(x.currentTarget.responseText);
				console.log( triggerResp );
				if( triggerResp.done == true ){
					CCP.triggerNames = {};
					for( var index = 0 ; index < triggerResp.records.length; index++ ){
						var trig = triggerResp.records[index];
						CCP.triggerNames[trig.Id] = trig.Name;
					}
					console.table( CCP.triggerNames );
					CCP.triggerNamesLoaded = true;
					CCP.loadCoverage();
				}
			}
		};
		xhr.send();
	},
	
	loadClasses : function(){
		var toolingCoverageEndPoint = PG.baseURL + CCP.EndPoint.apexclasses;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", toolingCoverageEndPoint , true);
		xhr.setRequestHeader("Content-type","application/json");
		xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
		xhr.onreadystatechange = function(x) {
			if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
				triggerResp = JSON.parse(x.currentTarget.responseText);
				console.log( triggerResp );
				if( triggerResp.done == true ){
					CCP.classNames = [];
					for( var index = 0 ; index < triggerResp.records.length; index++ ){
						var cls = triggerResp.records[index];
						CCP.classNames[cls.Id] = cls.Name;
					}
					console.table( CCP.classNames );
					CCP.clsssNamesLoaded = true;
					CCP.loadCoverage();
				}
			}
		};
		xhr.send();
	},

	loadCoverage : function(){
		if( CCP.clsssNamesLoaded == false || CCP.triggerNamesLoaded == false )
			return;
		
		var toolingCoverageEndPoint = PG.baseURL + CCP.EndPoint.coverage;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", toolingCoverageEndPoint , true);
		xhr.setRequestHeader("Content-type","application/json");
		xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
		xhr.onreadystatechange = function(x) {
			if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
				var coverage = JSON.parse(x.currentTarget.responseText);
				console.log( coverage );
				if( coverage.done == true ){
					var lstcoverage = [];
					for( var index = 0 ; index < coverage.records.length; index++ ){
						var cov = coverage.records[index];
						var covered = cov.Coverage.coveredLines.length;
						var uncovered = cov.Coverage.uncoveredLines.length;
						
						var percentage = Math.round ( ( covered *100 ) / (uncovered + covered) ) || 0;
						var id = cov.ApexClassOrTriggerId;
						var name = CCP.triggerNames[id] || CCP.classNames[id];
						lstcoverage.push( {'classname' : name, 'percentage' : percentage } );
					}
					console.table( lstcoverage );
					CCP.generateCoverage(lstcoverage);
				}
			}
		};
		xhr.send();
	},
	
	generateCoverage : function (lstcoverage){
		var coverage = '';
		for(var index = 0; index < lstcoverage.length; index++){
			coverage += lstcoverage[index].classname + ', ' + lstcoverage[index].percentage + '%\n';
		}
		$('<div>Copy-Paste below CSV data or  <a href="'+ encodeURI("data:text/csv;charset=utf-8," + coverage)+'" download="' +'coverage.csv">click to Download</a> file.</div>')
			.prependTo( $('#output').parent() );

		document.getElementById('output').value = coverage;
		document.getElementById('loading').style.display = 'none';
		$('#page2').hide();
		$('#output').show();
	}
}

var MetaData = {
	endPoint : '/services/Soap/m/35.0',
	retrieve : function(csName){
		var reqBody = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">'+
						'   <soapenv:Header>'+
						'      <met:CallOptions>'+
						'         <met:client>1</met:client>'+
						'      </met:CallOptions>'+
						'      <met:SessionHeader>'+
						'         <met:sessionId>'+ PG.session  + '</met:sessionId>'+
						'      </met:SessionHeader>'+
						'   </soapenv:Header>'+
						'   <soapenv:Body>'+
						'      <met:retrieve>'+
						'         <met:retrieveRequest>'+
						'            <met:apiVersion>34.0</met:apiVersion>'+
						'            <met:packageNames>'+ csName +'</met:packageNames>'+
						'            <met:singlePackage>1</met:singlePackage>'+
						'         </met:retrieveRequest>'+
						'      </met:retrieve>'+
						'   </soapenv:Body>'+
						'</soapenv:Envelope>';
		console.log( reqBody );
		var xhr = new XMLHttpRequest();
		xhr.open("POST", PG.baseURL + MetaData.endPoint , true);
		xhr.setRequestHeader("Content-type","text/xml");
		xhr.setRequestHeader("SOAPAction", "''");

		xhr.onreadystatechange = function(x) {
			if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
				console.log(x.currentTarget.responseText)
				var x2js = new X2JS({});
				var res = x2js.xml_str2json(x.currentTarget.responseText);
				console.log( res );
				if(res.Envelope.Body.retrieveResponse.result.state == 'Queued'){
					$('#status').html( res.Envelope.Body.retrieveResponse.result.state);
					MetaData.retrieveStatus(res.Envelope.Body.retrieveResponse.result.id);
				}
			}
		}
		xhr.send(reqBody);
	},
	
	retrieveStatus : function(id){
		var reqBody = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">'+
						'   <soapenv:Header>'+
						'      <met:CallOptions>'+
						'         <met:client>1</met:client>'+
						'      </met:CallOptions>'+
						'      <met:SessionHeader>'+
						'         <met:sessionId>'+ PG.session +'</met:sessionId>'+
						'      </met:SessionHeader>'+
						'   </soapenv:Header>'+
						'   <soapenv:Body>'+
						'      <met:checkRetrieveStatus>'+
						'         <met:asyncProcessId>'+ id +'</met:asyncProcessId>'+
						'         <met:includeZip>1</met:includeZip>'+
						'      </met:checkRetrieveStatus>'+
						'   </soapenv:Body>'+
						'</soapenv:Envelope>';
		//console.log( reqBody );
		var xhr = new XMLHttpRequest();
		xhr.open("POST", PG.baseURL + MetaData.endPoint , true);
		xhr.setRequestHeader("Content-type","text/xml");
		xhr.setRequestHeader("SOAPAction", "''");

		xhr.onreadystatechange = function(x) {
			if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
				//console.log(x.currentTarget.responseText)
				var x2js = new X2JS({});
				var res = x2js.xml_str2json(x.currentTarget.responseText);
				//console.log( res );
				if(res.Envelope.Body.checkRetrieveStatusResponse.result.status != 'Succeeded'){
					$('#status').html( res.Envelope.Body.checkRetrieveStatusResponse.result.status);
					window.setTimeout(function(){
						MetaData.retrieveStatus(res.Envelope.Body.checkRetrieveStatusResponse.result.id);
					}, 100);
				}else if(res.Envelope.Body.checkRetrieveStatusResponse.result.status == 'Succeeded'){
					
					var zipFile = res.Envelope.Body.checkRetrieveStatusResponse.result.zipFile;
					//console.log(res.Envelope.Body.checkRetrieveStatusResponse.result.zipFile);
			
					$('<div>Copy-Paste below CSV data or  <a href="'+ encodeURI("data:application/zip;base64," + zipFile )+'" download="' +'package.zip">click to Download</a> zipped package.</div>')
						.prependTo( $('#output').parent() );
						
					var zip = new JSZip();
					zip.load(zipFile, {'base64':true});
						
					document.getElementById('output').value = zip.file("package.xml").asText();
					document.getElementById('loading').style.display = 'none';
					$('#status').html( res.Envelope.Body.checkRetrieveStatusResponse.result.status);
					$('#page2').hide();
					$('#output').show();
				}
			}
		}
		xhr.send(reqBody);
	}
}

//BigSQL
var BQ = {
	Id : null,
	sObjectName: null,
	lstFields : [],
	data: [],
	SOQLEndPoint : '/services/data/v35.0/query/?q=',
	
	initBQ : function(){
		BQ.data = [];
		BQ.lstFields= [];
		BQ.mapFields = {};
		BQ.sObjectName = null;
		
		BQ.Id = PG.tab.url.match(/[\d\w]{15}/) + "";
		if(BQ.Id == null || BQ.Id == undefined || BQ.Id == "" || BQ.Id == "null"){
			document.getElementById('output').value = 'Please navigate to any record\'s detail/edit page in salesforce.';
			return;
		}
		
		if(PG.baseURL.indexOf('visual.force.com') != -1){
			document.getElementById('output').value = 'Please navigate to any record\'s detail/edit page in Salesforce.com, currently you are on visual.force.com.';
			return;
		}
		BQ.getFields(BQ.Id);
		$('#page2 table').remove();
	},
	
	getFields : function(Id){
		
		if( Id.match(/^006/) != null ){
			BQ.sObjectName = 'Opportunity';
		}
		var conn = new jsforce.Connection({
		  serverUrl : PG.baseURL,
		  sessionId : PG.session
		});
		
		// first get sObjectType.
		$('#status').html('Looking for sObject Name.');
		conn.describeGlobal(function(err, res) {
		  	if (err || res == null ) {
			  $('#status').html('Error while fetching sObject API name.');
			  return console.error(err); 
			}
			console.log(res.sobjects);
			for(var index=0; index < res.sobjects.length; index++ ){
				sobjectType = res.sobjects[index];
				if( sobjectType.keyPrefix == Id.substring(0,3) ){
					BQ.sObjectName = sobjectType.name;
					$('#status').html('Found sObject ' + BQ.sObjectName + '...');
					break;
				}
			}
			
			if(BQ.sObjectName != null ){
				$('#status').html('Fetching fields API names...');
				conn.sobject(BQ.sObjectName).describe(function(err, meta) {
				  if (err || meta == null){
					$('#status').html('Error wile fetching fields.')
					return console.error(err); 
				  }
				  console.table(meta.fields);
				  $('#status').html('Found total ' + meta.fields.length + ' fields.');
				  BQ.lstFields = [];
				  for(var index=0; index <  meta.fields.length; index++){
					var f =  meta.fields[index];
					if(f.type != 'address' && f.type != 'textarea' && f.name != 'LastViewedDate' && f.name != 'LastReferencedDate' && f.name != 'ContractId' ){
						BQ.lstFields.push (f);
						BQ.mapFields[f.name] = f;
					}
				  }
				  BQ.getData();
				});
			}else{
				document.getElementById('output').value = 'Please navigate to any record\'s detail/edit page in salesforce.';
			}
			
		});
	},
	
	getData : function(){
		if(BQ.Id == null || BQ.sObjectName == null || BQ.lstFields == null ){
			return;
		}
		
		var count = 1;
		var XHRCount = 0;
		var divisions = Math.ceil(BQ.lstFields.length/100);
		var divArr = [];
		
		for(var i=0; i < BQ.lstFields.length; i++){
			divArr.push(BQ.lstFields[i].name);
			if( count*10 == i || i == BQ.lstFields.length-1){
				$('#status').html('Firing SOQL...');
				var SQL = 'select ' + divArr.join(',')  + ' From ' + BQ.sObjectName + ' where id= ' + '\''+ BQ.Id + '\'';
				var SQLURI = PG.baseURL + BQ.SOQLEndPoint + SQL;
				try{
					var xhr = new XMLHttpRequest();
					xhr.open("GET", SQLURI , true);
					xhr.setRequestHeader("Content-type","application/json");
					xhr.setRequestHeader("Authorization", "Bearer " + PG.session);
									
					xhr.onreadystatechange = function(x) {
						try{
							if (x.currentTarget.readyState == 4 && x.currentTarget.status == 200 ) {
								$('#status').html('Got response of SOQL ' + XHRCount + '...');
								console.log(x.currentTarget.responseText);
								var res = JSON.parse(x.currentTarget.response);
								
								for(var attrib in res.records[0]){
									if( attrib != 'attributes' ){
										BQ.data.push( {'name' : attrib, 'val' : res.records[0][attrib], 'label' : BQ.mapFields[attrib].label });
									}
								}
								XHRCount--;
								if(XHRCount==0){
									BQ.dataLoaded();
								}
							}else if(x.currentTarget.readyState == 4 && x.currentTarget.status == 400){
								XHRCount--;
								if(XHRCount==0){
									BQ.dataLoaded();
								}
							}
						}catch(ex){
							XHRCount--;
							if(XHRCount==0){
								BQ.dataLoaded();
							}
						}
					}
					xhr.send();
				}catch(ex){
					
				}
				
				XHRCount++;
				//reset
				divArr = [];
				count++;
			}
		}
		
			
	},
	
	dataLoaded : function(){
		var d = [];
		$('#status').html('Loading data in table...');
						
		if(BQ.data.length > 0 ){
			for(var i=0; i < BQ.data.length; i++){
				d.push( '<tr><td>' + BQ.data[i].label + '</td><td class="fieldAPIName" APIName="' + BQ.data[i].name + '">' + BQ.data[i].name + '</td><td>' + BQ.data[i].val + '</td></tr>');
			}
			document.getElementById('output').value = d.join('\n');
			$('<table style="margin:10px;" id="dataTble" class="table-bordered"><tr><th>Field Label</th><th>Field Name</th><th>value</th></tr></table>').append(d.join('')).appendTo('#page2');
			$('#page2').show();
			$('#output').hide();
			$('#status').html('Done...');
		}
	},
	
	search : function(evt){
		var searchText = $('#search').val();
		if(searchText.length > 1){
			$('#dataTble td.fieldAPIName').each(function(){
				if($(this).text().toLowerCase().indexOf(searchText.toLowerCase()) == -1 ){
					$(this).parent().hide();
				}else{
					$(this).parent().show();
				}
			});
		}else{
			$('#dataTble td.fieldAPIName').parent().show();
		}
	}
}//BQ end

document.addEventListener('DOMContentLoaded', function () {
  PG.init();
  document.getElementById('btn').addEventListener('click', PG.packageHandler );
  document.getElementById('testcoveragebtn').addEventListener( 'click', CCP.handleGetCoverage );
  document.getElementById('BigQuery').addEventListener( 'click', BQ.initBQ );
  document.getElementById('search').addEventListener( 'keyup', BQ.search );
});
