using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTodoMain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MainId",
                table: "Todos",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            // Backfill: every existing task needs a main. Take the main of the task's
            // first subcategory (by sub id); fall back to the first main for any task
            // that had no subs. Runs before the FK is added below.
            migrationBuilder.Sql(@"
                UPDATE ""Todos"" SET ""MainId"" = (
                    SELECT s.""MainId"" FROM ""TodoSub"" ts
                    JOIN ""Subs"" s ON s.""Id"" = ts.""CategoriesId""
                    WHERE ts.""TodosId"" = ""Todos"".""Id""
                    ORDER BY s.""Id"" LIMIT 1)
                WHERE EXISTS (SELECT 1 FROM ""TodoSub"" ts WHERE ts.""TodosId"" = ""Todos"".""Id"");");
            migrationBuilder.Sql(@"
                UPDATE ""Todos"" SET ""MainId"" = (SELECT ""Id"" FROM ""Mains"" ORDER BY ""Id"" LIMIT 1)
                WHERE ""MainId"" = '' OR ""MainId"" IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Todos_MainId",
                table: "Todos",
                column: "MainId");

            migrationBuilder.AddForeignKey(
                name: "FK_Todos_Mains_MainId",
                table: "Todos",
                column: "MainId",
                principalTable: "Mains",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Todos_Mains_MainId",
                table: "Todos");

            migrationBuilder.DropIndex(
                name: "IX_Todos_MainId",
                table: "Todos");

            migrationBuilder.DropColumn(
                name: "MainId",
                table: "Todos");
        }
    }
}
