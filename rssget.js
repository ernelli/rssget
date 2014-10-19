var xml2js = require('xml2js');
var fs = require('fs');
var request = require('request');
var http = require('http');
var Transmission = require('transmission');

var config = {
    url: "",
    transmission: {}
};

try {
    config = JSON.parse(fs.readFileSync("config.json"));
} catch(e) {
    console.log("config file missing or bad; generating default config: ", e);
    //fs.writeFileSync("config.json", JSON.stringify(config));
    process.exit(1);
}


console.log("using config: ", config);

var xmlparser = new xml2js.Parser();

var tm = new Transmission(config.transmission);

function getrss() {
request({ uri: config.url, method: "GET"}, function(err, res, xml) {
    if(err) {
        console.log("rssget failed: ", err);
        return;
    }

    if(res.statusCode !== 200) {
        console.log("url fetch failed: ", res);
        return;        
    }

    xmlparser.parseString(xml, function(err, rss) {
        if(err) {
            console.log("invalid xml: ", err);
            return;
        }

        console.log("got RSS: ", rss);

        var torrents = [];

        var i;

        rss = rss.rss;
       
        for(i = 0; i < rss.channel.length; i++) {
            var channel = rss.channel[i];
            //console.log("channel: ", );
            for(var j = 0; j < channel.item.length; j++) {
                var item = channel.item[j];
                console.log("item");
                console.log("title: ", item.title);
                console.log("link: ", item.link);
            }
        }
    });

});
}

tm.active(function(err, res) {
    if(err) {
        console.log("failed to communicate with transmission-daemon: ", err);
        process.exit(1);
    }

    console.log("active: ", res);
    getrss();
});

