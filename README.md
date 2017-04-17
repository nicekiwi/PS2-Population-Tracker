PS2-Population-Tracker
======================

A simple script to listen to login/logout events from the planetside 2 streaming api. Characters are saved into a remote database using bookshelf/knex. Refer to psarchives.com for a website that uses the population data

### Environment variables

Environment variables must be set in process.yaml when using pm2.

Refer to the sample process.yaml.example

### Install

Install packages with

```
npm install
```

### Run

Run with pm2

```
pm2 start process.yaml
```


### Database Structure

This project is a module within the larger PSArchives project. This uses its database and hence no migrations exist here. The table structure for `population` is as follows (PostgreSQL sample)

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
    head_id integer,
    login timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
```
