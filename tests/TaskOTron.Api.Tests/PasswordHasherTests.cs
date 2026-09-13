using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

public class PasswordHasherTests
{
    [Fact]
    public void Verify_accepts_the_password_that_was_hashed()
    {
        var hash = PasswordHasher.Hash("correct horse battery staple");
        Assert.True(PasswordHasher.Verify("correct horse battery staple", hash));
    }

    [Fact]
    public void Verify_rejects_a_wrong_password()
    {
        var hash = PasswordHasher.Hash("correct horse battery staple");
        Assert.False(PasswordHasher.Verify("wrong password", hash));
    }

    [Fact]
    public void Hash_is_salted_so_the_same_password_hashes_differently_each_time()
    {
        var a = PasswordHasher.Hash("same password");
        var b = PasswordHasher.Hash("same password");
        Assert.NotEqual(a, b);
        Assert.True(PasswordHasher.Verify("same password", a));
        Assert.True(PasswordHasher.Verify("same password", b));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-valid-hash")]
    [InlineData("abc.def")]
    [InlineData("notanumber.c2FsdA==.aGFzaA==")]
    public void Verify_returns_false_instead_of_throwing_on_malformed_input(string encoded)
    {
        Assert.False(PasswordHasher.Verify("anything", encoded));
    }
}
