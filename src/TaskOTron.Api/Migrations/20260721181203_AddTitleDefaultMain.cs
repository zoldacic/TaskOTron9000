using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTitleDefaultMain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MainId",
                table: "TitleDefaults",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TitleDefaults_MainId",
                table: "TitleDefaults",
                column: "MainId");

            migrationBuilder.AddForeignKey(
                name: "FK_TitleDefaults_Mains_MainId",
                table: "TitleDefaults",
                column: "MainId",
                principalTable: "Mains",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TitleDefaults_Mains_MainId",
                table: "TitleDefaults");

            migrationBuilder.DropIndex(
                name: "IX_TitleDefaults_MainId",
                table: "TitleDefaults");

            migrationBuilder.DropColumn(
                name: "MainId",
                table: "TitleDefaults");
        }
    }
}
