import Database from 'better-sqlite3';

const db = new Database('./offers.db');
['Infojobs','Adecco','Manpower'].forEach(e=>{
  const o=db.prepare('SELECT url FROM offers WHERE ett_name=? LIMIT 1').get(e);
  console.log(e, o?.url)
});
db.close();
