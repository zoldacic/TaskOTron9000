using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTodoNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "Todos",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Note",
                table: "Todos");
        }
    }
}
