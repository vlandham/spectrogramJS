var sqlite3 = require('sqlite3').verbose()

const DBSOURCE = "database.db"

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      // Cannot open database
      console.error(err.message)
      throw err
    }
    else {
        console.error("Connected to database")
    }
});


module.exports = db
