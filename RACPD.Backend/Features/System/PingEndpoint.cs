using FastEndpoints;

namespace RACPD.Backend.Features.System;

public class PingEndpoint : EndpointWithoutRequest<object>
{
    public override void Configure()
    {
        Get("/api/ping");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        await HttpContext.Response.WriteAsync("Pong", ct);
    }
}
