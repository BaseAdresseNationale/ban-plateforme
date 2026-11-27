'use strict'

const ACTION_SESSION_FK = 'action_sessionID_fkey'

const getActionSessionFkName = async ({queryInterface, transaction}) => {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'ban.action'::regclass
      AND contype = 'f'
      AND confrelid = 'ban.session'::regclass
  `, {transaction})

  if (rows.length !== 1) {
    throw new Error(`Expected one foreign key from ban.action to ban.session, found ${rows.length}`)
  }

  return rows[0].conname
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const fkName = await getActionSessionFkName({queryInterface, transaction})

      // An action outlives the session it was made with: the link is cleared when the session is purged.
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.action DROP CONSTRAINT "${fkName}";
        ALTER TABLE ban.action ALTER COLUMN "sessionID" DROP NOT NULL;
        ALTER TABLE ban.action ADD CONSTRAINT "${ACTION_SESSION_FK}"
          FOREIGN KEY ("sessionID") REFERENCES ban.session(id) ON DELETE SET NULL;
      `, {transaction})

      // Existing sessions were never verified against ProConnect: they are dropped, agents log in again.
      await queryInterface.sequelize.query('DELETE FROM ban.session;', {transaction})

      // The table is empty at this point, so the NOT NULL columns need no default.
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.session
          ADD COLUMN "tokenHash" VARCHAR(64) NULL,
          ADD COLUMN "acr" VARCHAR(255) NULL,
          ADD COLUMN "amr" VARCHAR(255)[] NULL,
          ADD COLUMN "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          ADD COLUMN "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL;
        CREATE UNIQUE INDEX session_token_hash_key ON ban.session ("tokenHash");
      `, {transaction})
    })
  },

  // Deleted sessions and the cleared action links are not restored, and "sessionID" stays nullable.
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const fkName = await getActionSessionFkName({queryInterface, transaction})

      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS ban.session_token_hash_key;
        ALTER TABLE ban.session
          DROP COLUMN "tokenHash",
          DROP COLUMN "acr",
          DROP COLUMN "amr",
          DROP COLUMN "expiresAt",
          DROP COLUMN "lastSeenAt";
        ALTER TABLE ban.action DROP CONSTRAINT "${fkName}";
        ALTER TABLE ban.action ADD CONSTRAINT "${ACTION_SESSION_FK}"
          FOREIGN KEY ("sessionID") REFERENCES ban.session(id);
      `, {transaction})
    })
  },
}
