using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class Init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Mains",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mains", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitleDefaults",
                columns: table => new
                {
                    NormalizedTitle = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitleDefaults", x => x.NormalizedTitle);
                });

            migrationBuilder.CreateTable(
                name: "Todos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Done = table.Column<bool>(type: "INTEGER", nullable: false),
                    Due = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    Amount = table.Column<decimal>(type: "TEXT", nullable: true),
                    DateKind = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Todos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Subs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    MainId = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Subs_Mains_MainId",
                        column: x => x.MainId,
                        principalTable: "Mains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TitleDefaultSub",
                columns: table => new
                {
                    CategoriesId = table.Column<string>(type: "TEXT", nullable: false),
                    TitleDefaultsNormalizedTitle = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitleDefaultSub", x => new { x.CategoriesId, x.TitleDefaultsNormalizedTitle });
                    table.ForeignKey(
                        name: "FK_TitleDefaultSub_Subs_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "Subs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TitleDefaultSub_TitleDefaults_TitleDefaultsNormalizedTitle",
                        column: x => x.TitleDefaultsNormalizedTitle,
                        principalTable: "TitleDefaults",
                        principalColumn: "NormalizedTitle",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TodoSub",
                columns: table => new
                {
                    CategoriesId = table.Column<string>(type: "TEXT", nullable: false),
                    TodosId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TodoSub", x => new { x.CategoriesId, x.TodosId });
                    table.ForeignKey(
                        name: "FK_TodoSub_Subs_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "Subs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TodoSub_Todos_TodosId",
                        column: x => x.TodosId,
                        principalTable: "Todos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Subs_MainId",
                table: "Subs",
                column: "MainId");

            migrationBuilder.CreateIndex(
                name: "IX_TitleDefaultSub_TitleDefaultsNormalizedTitle",
                table: "TitleDefaultSub",
                column: "TitleDefaultsNormalizedTitle");

            migrationBuilder.CreateIndex(
                name: "IX_TodoSub_TodosId",
                table: "TodoSub",
                column: "TodosId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TitleDefaultSub");

            migrationBuilder.DropTable(
                name: "TodoSub");

            migrationBuilder.DropTable(
                name: "TitleDefaults");

            migrationBuilder.DropTable(
                name: "Subs");

            migrationBuilder.DropTable(
                name: "Todos");

            migrationBuilder.DropTable(
                name: "Mains");
        }
    }
}
