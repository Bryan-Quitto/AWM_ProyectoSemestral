using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using Supabase.Gotrue;

namespace RACPD.Backend.Features.Usuarios.Invitar;

public record InvitarUsuarioRequest(string Correo, string Nombre, string Apellido, Rol Rol);
public record InvitarUsuarioResponse(string Mensaje);

public class InvitarEndpoint : Endpoint<InvitarUsuarioRequest, InvitarUsuarioResponse>
{
    private readonly AdminClient _adminClient;
    private readonly AppDbContext _dbContext;

    public InvitarEndpoint(AdminClient adminClient, AppDbContext dbContext)
    {
        _adminClient = adminClient;
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Post("/api/usuarios/invitar");
        Roles(Rol.AdministradorSistema.ToString());
    }

    public override async Task HandleAsync(InvitarUsuarioRequest req, CancellationToken ct)
    {
        try
        {
            var inviteSuccess = await _adminClient.InviteUserByEmail(req.Correo);
            
            if (!inviteSuccess)
            {
                AddError("No se pudo invitar al usuario a través de Supabase.");
                ThrowIfAnyErrors();
            }

            var usersList = await _adminClient.ListUsers();
            var supabaseUser = usersList?.Users?.FirstOrDefault(u => u.Email == req.Correo);

            if (supabaseUser == null || string.IsNullOrEmpty(supabaseUser.Id))
            {
                AddError("No se encontró el ID del usuario en Supabase tras la invitación.");
                ThrowIfAnyErrors();
                return; // Ensure compiler knows we exit here
            }

            if (!Guid.TryParse(supabaseUser.Id, out var supabaseUserId))
            {
                AddError("El ID de usuario devuelto por Supabase no es válido.");
                ThrowIfAnyErrors();
            }

            var nuevoUsuario = new Usuario
            {
                Id = supabaseUserId,
                Correo = req.Correo,
                Nombre = req.Nombre,
                Apellido = req.Apellido,
                Rol = req.Rol
            };

            _dbContext.Usuarios.Add(nuevoUsuario);
            await _dbContext.SaveChangesAsync(ct);

            HttpContext.Response.StatusCode = 200;
            await HttpContext.Response.WriteAsJsonAsync(new InvitarUsuarioResponse("Invitación enviada con éxito."), cancellationToken: ct);
        }
        catch (Exception ex)
        {
            AddError($"Ocurrió un error al invitar al usuario: {ex.Message}");
            ThrowIfAnyErrors();
        }
    }
}
