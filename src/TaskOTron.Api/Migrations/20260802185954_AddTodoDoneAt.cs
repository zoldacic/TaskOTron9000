using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTodoDoneAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DoneAt",
                table: "Todos",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DoneAt",
                table: "Todos");
        }
    }
}
