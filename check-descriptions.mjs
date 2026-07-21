import Database from 'better-sqlite3';

const db = new Database('./offers.db');
['Infojobs','Adecco','Manpower'].forEach(e=>{
  const o=db.prepare('SELECT title, description FROM offers WHERE ett_name=? LIMIT 1').get(e);
  console.log(`\n${e}:`);
  console.log('Title:', o?.title?.substring(0,60));
  console.log('Description:', (o?.description || '(empty)').substring(0,60));
});
db.close();
