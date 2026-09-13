using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBudgets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Budgets",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    From = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    To = table.Column<DateOnly>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Budgets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BudgetItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BudgetId = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Amount = table.Column<decimal>(type: "TEXT", nullable: false),
                    Quantity = table.Column<decimal>(type: "TEXT", nullable: true),
                    UnitPrice = table.Column<decimal>(type: "TEXT", nullable: true),
                    MainId = table.Column<string>(type: "TEXT", nullable: true),
                    Note = table.Column<string>(type: "TEXT", nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BudgetItems_Budgets_BudgetId",
                        column: x => x.BudgetId,
                        principalTable: "Budgets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BudgetItems_Mains_MainId",
                        column: x => x.MainId,
                        principalTable: "Mains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "BudgetItemSub",
                columns: table => new
                {
                    BudgetItemsId = table.Column<int>(type: "INTEGER", nullable: false),
                    CategoriesId = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetItemSub", x => new { x.BudgetItemsId, x.CategoriesId });
                    table.ForeignKey(
                        name: "FK_BudgetItemSub_BudgetItems_BudgetItemsId",
                        column: x => x.BudgetItemsId,
                        principalTable: "BudgetItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BudgetItemSub_Subs_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "Subs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BudgetItems_BudgetId",
                table: "BudgetItems",
                column: "BudgetId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetItems_MainId",
                table: "BudgetItems",
                column: "MainId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetItemSub_CategoriesId",
                table: "BudgetItemSub",
                column: "CategoriesId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BudgetItemSub");

            migrationBuilder.DropTable(
                name: "BudgetItems");

            migrationBuilder.DropTable(
                name: "Budgets");
        }
    }
}
