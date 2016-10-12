var xml2js = require('xml2js');
var fs = require('fs');
var request = require('request');
var http = require('http');
var querystring = require('querystring');
var Transmission = require('transmission');

function mixin(a, b) {
    for(i in b) {
        a[i] = b[i];
    }
    return a;
}

var config = {
    showrss: {
        user_id: "",
        hd: "null",
        proper: "null"
    },
    transmission: {
        host: "localhost",
        user: "transmission",
        password: ""},
    "poll-interval": 600,
};

try {
    var jsonConfig = fs.readFileSync("config.json")
} catch(e1) {
    console.log("config file missing or bad; generating default config: ", e1);
    fs.writeFileSync("config.json", JSON.stringify(config));
    process.exit(1);
}

try {
    fileConfig = JSON.parse(jsonConfig);
} catch(e2) {
    console.log("bad config file: ", e2);
    process.exit(1);
}

mixin(config, fileConfig);

console.log("using config: ", config);

var ledger;

try {
    ledger = JSON.parse(fs.readFileSync("ledger.json"));
} catch(e3) {
    console.log("initialising ledger file");
    fs.writeFileSync("ledger.json", JSON.stringify(ledger));
    ledger = {};
}


function writeLedger() {
    console.log("write data to ledger: ", JSON.stringify(ledger));

    fs.writeFileSync("ledger.json_", JSON.stringify(ledger));

    if(fs.existsSync("ledger.json~")) {
        fs.unlinkSync("ledger.json~");
    }
    
    if(fs.existsSync("ledger.json")) {
        fs.renameSync("ledger.json", "ledger.json~");
    }

    fs.renameSync("ledger.json_", "ledger.json");
}

var xmlparser = new xml2js.Parser();

var tm = new Transmission(config.transmission);

// mock transmission API when testing the rss parser w:o adding the torrents
tm.addUrlx = function(link, cb) {
    console.log("adding url to transmission: " + link);
    setTimeout(function() {
        console.log("url added, transmission done");
        cb();
    }, 1000);
}

function getrss(config, cb) {
    var uri = config.url ? config.url :  "http://showrss.info/rss.php?" + querystring.stringify(config);
    
    console.log("get uri: " + uri);

    request({ uri: uri, method: "GET"}, function(err, res, xml) {
    if(err) {
        console.log("rssget, request failed: ", err);
        return;
    }

    if(res.statusCode !== 200) {
        console.log("url fetch failed, status not 200 OK: ", res);
        cb("rssget, request failed, status code: " + res.statusCode);
        return;        
    }

    xmlparser.parseString(xml, function(err, rss) {
        if(err) {
            console.log("invalid xml: ", err);
            cb(err);
            return;
        }

        console.log("got RSS: ", rss);

        var torrents = [];

        var i = 0;
        var j = 0;

        rss = rss.rss;
       
        function nextChannel() {
            if(i < rss.channel.length) {
                var channel = rss.channel[i++];    
                j = 0;
                function nextItem() {
                    if(j < channel.item.length) {
                        var item = channel.item[j++];
                        console.log("item: ", item);
                        
                        var title = item.title[0];
                        var link = item.link[0];
                        
                        console.log("title: ", title);
                        console.log("link: ", link);
                        
                        var fields = querystring.parse(link.split("?")[1]);
                        console.log("link fields: ", fields);
                        
                        var xt = fields.xt || link;
                        
                        console.log("check ledger for xt: " + xt);

                        if(!xt || !ledger[xt]) {
                            console.log("adding torrent url: " + link);
                            tm.addUrl(link, function(err, res) {
                                // store in ledger that torrent has been added
                                
                                if(err) {
                                    console.log("Failed to add torrent: ", err);
                                } else {
                                    console.log("torrent added, res: ", res);
                                    ledger[xt] = {
                                        title: title,
                                        timestamp: Date.now()
                                    };
                                    console.log("updating ledger with: ", ledger[xt]);
                                    writeLedger();
                                    console.log("ledger updated");
                                }
                                nextItem();
                            });
                        } else {
                            console.log("skip torrent, already in ledger: " + xt);
                            nextItem();
                        }
                    } else {
                        nextChannel();
                    }
                }
                //start iterating items
                try {
                   nextItem();
                } catch(e1) {
                   console.log("Failed to parse rss feed: " + e1);
		   console.log("xml:\n" + xml);
		   cb(e1);
               }
            } else {
                // all channels done
                cb(false);
            }
        }
        // start iterating channels
        nextChannel();
        
    });

});
}

var pollInterval = 1*config["poll-interval"];
if(!pollInterval || typeof pollInterval !== "number") {
    pollInterval = 3600;
}

if(pollInterval < 600) {
    console.log("polling interval must be at least 10 min");
    pollInterval = 600;
}

tm.active(function(err, res) {
    if(err) {
        console.log("failed to communicate with transmission-daemon: ", err);
        process.exit(1);
    }

    console.log("active: ", res);
    
    function poll() {
        getrss(config, function(err, res) {
            if(err) {
                console.log("getrss failed: ", err);
            }
            
            console.log("getrss done wait until next rss poll in " + pollInterval + " seconds");
            setTimeout(poll, 1000*pollInterval);
        });
    }
    poll();
});

