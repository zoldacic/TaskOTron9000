using System.Net;
using Microsoft.AspNetCore.Http;
using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

public class NetworkUtilTests
{
    [Theory]
    [InlineData("127.0.0.1")]      // loopback
    [InlineData("10.0.0.1")]       // 10.0.0.0/8
    [InlineData("172.16.0.1")]     // 172.16.0.0/12 (low end)
    [InlineData("172.31.255.255")] // 172.16.0.0/12 (high end)
    [InlineData("192.168.1.42")]   // 192.168.0.0/16
    [InlineData("169.254.1.1")]    // link-local
    [InlineData("::1")]            // IPv6 loopback
    [InlineData("fd12:3456:789a::1")] // fc00::/7 unique local
    [InlineData("fe80::1")]        // IPv6 link-local
    public void IsPrivate_true_for_local_network_addresses(string ip)
    {
        Assert.True(NetworkUtil.IsPrivate(IPAddress.Parse(ip)));
    }

    [Theory]
    [InlineData("8.8.8.8")]        // public DNS
    [InlineData("172.32.0.1")]     // just outside 172.16.0.0/12
    [InlineData("172.15.255.255")] // just outside 172.16.0.0/12
    [InlineData("1.2.3.4")]
    [InlineData("2001:4860:4860::8888")] // public IPv6 (Google DNS)
    public void IsPrivate_false_for_public_addresses(string ip)
    {
        Assert.False(NetworkUtil.IsPrivate(IPAddress.Parse(ip)));
    }

    [Fact]
    public void IsLocalRequest_reflects_the_connection_remote_ip()
    {
        var local = new DefaultHttpContext();
        local.Connection.RemoteIpAddress = IPAddress.Parse("192.168.1.5");
        Assert.True(NetworkUtil.IsLocalRequest(local));

        var remote = new DefaultHttpContext();
        remote.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.7");
        Assert.False(NetworkUtil.IsLocalRequest(remote));
    }

    [Fact]
    public void IsLocalRequest_false_when_remote_ip_is_unknown()
    {
        var ctx = new DefaultHttpContext(); // RemoteIpAddress null
        Assert.False(NetworkUtil.IsLocalRequest(ctx));
    }
}
