using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskOTron.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBankAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankAccountId",
                table: "Todos",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BankAccounts",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankAccounts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Todos_BankAccountId",
                table: "Todos",
                column: "BankAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Todos_BankAccounts_BankAccountId",
                table: "Todos",
                column: "BankAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Todos_BankAccounts_BankAccountId",
                table: "Todos");

            migrationBuilder.DropTable(
                name: "BankAccounts");

            migrationBuilder.DropIndex(
                name: "IX_Todos_BankAccountId",
                table: "Todos");

            migrationBuilder.DropColumn(
                name: "BankAccountId",
                table: "Todos");
        }
    }
}
