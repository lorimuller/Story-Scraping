// require dependencies
var express = require("express");
var mongoose = require("mongoose");
var request = require("request");
var cheerio = require("cheerio");
var bodyParser = require("body-parser");
var exphbs = require("express-handlebars");

var PORT = process.env.PORT || 5000;

// initialize Express
var app = express();

// use body-parser for handling form submissions
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json({
    type: "application/json"
}));

// serve the public directory
app.use(express.static("public"));

// use promises with Mongo and connect to the database
var databaseUrl = "news";
mongoose.Promise = Promise;
// var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/news";
// mongoose.connect(MONGODB_URI);

var databaseUri = 'mongodb://localhost/news';

if (process.env.MONGODB_URI){
    mongoose.connect(process.env.MONGODB_URI);
} else {
    mongoose.connect(databaseUri);
}

var db = mongoose.connection;

db.on('error', function(err) {
    console.log("mongoose error: ", err);
});

db.once('open', function() {
    console.log('mongoose connection successful.');
});

// use handlebars
app.engine("handlebars", exphbs({
    defaultLayout: "main"
}));
app.set("view engine", "handlebars");

// Hook mongojs configuration to the db variable
var db = require("./models");

// get all articles from the database that are not saved
app.get("/", function (req, res) {

    db.Article.find({
        saved: false
    },

        function (error, dbArticle) {
            if (error) {
                console.log(error);
            } else {
                res.render("index", {
                    articles: dbArticle
                });
            }
        })
})

// use cheerio to scrape stories from The Onion and store them
app.get("/scrape", function (req, res) {
    console.log("SCRAPING");
    request("https://www.theonion.com/", function (error, response, html) {
        // Load the html body from request into cheerio
        var $ = cheerio.load(html);
        $("article").each(function (i, element) {

            // trim() removes whitespace because the items return \n and \t before and after the text
            var title = $(element).find("h1.headline").text().trim();
            var link = $(element).find("a.js_entry-link").attr("href");
            var intro = $(element).find("div.excerpt p").text().trim();
            console.log('title', title);
            console.log('link', link);
            console.log('intro', intro);

            // if these are present in the scraped data, create an article in the database collection
            if (title && link && intro) {
                db.Article.create({
                    title: title,
                    link: link,
                    intro: intro
                },
                    function (err, inserted) {
                        if (err) {
                            // log the error if one is encountered during the query
                            console.log(err);
                        } else {
                            // otherwise, log the inserted data
                            console.log(inserted);
                        }
                    });
            
                console.log(i);
                if (i === 10) {
                    return res.sendStatus(200);
                }
            }
        });
    });
});

// route for retrieving all the saved articles
app.get("/saved", function (req, res) {
    db.Article.find({
        saved: true
    })
        .then(function (dbArticle) {
            // if successful, then render with the handlebars saved page
            res.render("saved", {
                articles: dbArticle
            })
        })
        .catch(function (err) {
            // If an error occurs, send the error back to the client
            res.json(err);
        })

});

// route for setting an article to saved
app.put("/saved/:id", function (req, res) {
    db.Article.findByIdAndUpdate(
        req.params.id, {
            $set: req.body
        }, {
            new: true
        })
        .then(function (dbArticle) {
            res.render("saved", {
                articles: dbArticle
            })
        })
        .catch(function (err) {
            res.json(err);
        });
});

// route for saving a new note 
app.post("/submit/:id", function (req, res) {
    db.Note.create(req.body)
        .then(function (dbNote) {
            var articleIdFromString = mongoose.Types.ObjectId(req.params.id)
            return db.Article.findByIdAndUpdate(articleIdFromString, {
                $push: {
                    notes: dbNote._id
                }
            })
        })
        .then(function (dbArticle) {
            res.json(dbNote);
        })
        .catch(function (err) {
            // If an error occurs, send it back to the client
            res.json(err);
        });
});

// route to find a note by ID
app.get("/notes/article/:id", function (req, res) {
    db.Article.findOne({ "_id": req.params.id })
        .populate("notes")
        .exec(function (error, data) {
            if (error) {
                console.log(error);
            } else {
                res.json(data);
            }
        });
});


app.get("/notes/:id", function (req, res) {

    db.Note.findOneAndRemove({ _id: req.params.id }, function (error, data) {
        if (error) {
            console.log(error);
        } else {
        }
        res.json(data);
    });
});

// listen for the routes
app.listen(PORT, function () {
    console.log("App is running on " + PORT);
});


