using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class BackfillTodoDoneAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tasks completed before DoneAt existed have no stamp, so they'd vanish from the
            // start page's "done today". Their date is the best record of when they were done —
            // and it's exactly what that list used before — so adopt it as the completion day.
            migrationBuilder.Sql(
                "UPDATE Todos SET DoneAt = Due WHERE Done = 1 AND DoneAt IS NULL AND Due IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The pre-backfill stamps were all null, but only for rows that had none at the time —
            // which is no longer knowable, so this is deliberately not undone.
        }
    }
}
