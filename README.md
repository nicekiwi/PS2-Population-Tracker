PS2-Population-Tracker
======================

A simple script to listen to login/logout events from the planetside 2 streaming api. Characters are saved into remote database using bookshelf/knex. Refer to psarchives.com for a website that uses the population data

__Environment variables must be set in process.yaml__

Refer to the sample process.yaml.example

__Install__

Install packages with

```
npm install
```

__Run__

Run with pm2

```
pm2 start process.yaml
```


__Database Structure__

This project is module within the larger PSArchives project. This uses its database and hence no migrations exist here. The table structure for `population` is as follows (PostgreSQL sample)

```sql
create table population
(
    character_id varchar(255)
        constraint population_character_id_unique
            unique,
    name varchar(255),
    rank integer,
    outfit_id varchar(255),
    outfit_name varchar(255),
    outfit_tag varchar(255),
    world_id integer,
    faction_id integer,
    login timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
```