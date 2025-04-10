# GDPR x LLM

To Do:
- ~~For 404 error handling on write in page.~~
- ~~*Replace progress bar.*~~
  - ~~*Complete/Incomplete indicator on landing page.*~~
  - ~~*Time spent on question.*~~
- ~~*User paradigm.*~~
- ~~Unify formatting across all pages.~~
- *Randomize generator numbers.*
- ~~Ingest API endpoints.~~
- *Time tracking override.*
  - Time tracking override is not being implemented in this current iteration.
- ~~*Implement time tracking.*~~
  - ~~*Add duration columns to `writeins` and `ratings` tables.*~~
  - ~~*Add timers on front end.*~~

## Developing
The Node.js version used for this project is v22. Follow instructions [here](https://nodejs.org/en/download/) to install. After cloning the repository, run `npm install` to install the needed dependencies.

You may launch the backend server and the development webpage via the following commands.
```bash
node server.js
npm run dev -- --open
```

## Interacting with the Database
In order for the `server.js` file to communicate with the MySQL server, you must create a file in the respository's root and name it `db_config.json`. The file will follow the below structure.


```json
{
    "host": "localhost",
    "port": 5432,
    "database": "gdpr",
    "user": "your-user-here",
    "password": "your-password-here"
}
```

If you do not already have a database created, login to the MySQL terminal and source `load_schema.sql`. This will create the schema in the database. Then, source `load_sample_data.sql` to load in some fake data; this data only includes questions and possible responses created by models.

The purpose of `reset_user_content.sql` is to delete all user generated rows in the database. Specifically, sourcing this file will delete all rows in tables `writeins`, `writein_generations`, and `ratings`. `reset_database.sql` will delete all tables in the database; use with caution.

## Hosting
The current planned iteration of this tool does not provide for robust security. Therefore, as a broad safeguard against unauthorized access, the website as it's hosted will have [basic HTTP authentication](https://docs.nginx.com/nginx/admin-guide/security-controls/configuring-http-basic-authentication/).

More hosting information forthcoming...