# GDPR x LLM

To Do:
- Ingest API endpoints.
- Time tracking override.

## Developing
The Node.js version used for this project is v22. Follow instructions [here](https://nodejs.org/en/download/) to install. After cloning the repository, run `npm install` to install the needed dependencies.

You may launch the backend server and the development webpage via the following commands.
```bash
node server.js
npm run dev -- --open
```

## Interacting with the Database
For the `server.js` file to communicate with the MySQL server, you must create a file in the repository's root and name it `db_config.json`. The file will follow the below structure.


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

## Hosting and Deployment
The current planned iteration of this tool does not provide for robust security. Therefore, as a broad safeguard against unauthorized access, the website as it's hosted will have [basic HTTP authentication](https://docs.nginx.com/nginx/admin-guide/security-controls/configuring-http-basic-authentication/).

To deploy the site on a Ubuntu system, run the command `npm run preview`, verify that the site appears to be working properly, and then run `npm run build`. Run `node build/index.js` to verify that the build site functions properly. Them, copy the files from the `deployment` directory to `/etc/systemd/system`. Edit the files so that the correct path for this repository and `node` executable are properly in place. Refresh the system daemons and then start and enable the newly created daemons.


```bash
$ sudo systemctl daemon-reload
$ sudo systemctl start preferences-site
$ sudo systemctl start preferences-server
$ sudo systemctl enable preferences-site
$ sudo systemctl enable preferences-server
```

### Nginx Proxy Manager
After creating the daemons and verify that they are running properly, you must forward the ports to the internet. The [deployed site](https://preferences.gdpr-llm.org) uses Nginx Proxy Manager to help facilitate this.

The most important things to note about its deployment via this tool is that the forwarding scheme is `http`, the forwarded port is `3000`, and `/api` as a custom location is also defined which has a forwarded port of `3001` over `http`. SSL is enabled.