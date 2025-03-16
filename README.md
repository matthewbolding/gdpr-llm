# GDPR x LLM

To Do:
- Selector not displaying current number of items per page.
- Ranking or preference ranking dataset? (This will form the basis of v2.)

## Running the Project

## Developing
After cloning the repository, run `npm install` to install the needed dependencies.

```bash
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