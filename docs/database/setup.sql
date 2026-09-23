CREATE DATABASE IF NOT EXISTS lan_media
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'lan_media_user'@'localhost' IDENTIFIED BY 'change_me';
ALTER USER 'lan_media_user'@'localhost' IDENTIFIED BY 'change_me';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON lan_media.* TO 'lan_media_user'@'localhost';
FLUSH PRIVILEGES;
