import Controller from '@curveball/controller';
import { Context } from '@curveball/core';
import * as privilegeService from '../../privilege/service';
import * as hal from '../formats/hal';
import { Forbidden, UnprocessableEntity } from '@curveball/http-errors';
import { findByUser, create } from '../service';
import * as userService from '../../user/service';
import crypto from 'crypto';
import { GrantType, OAuth2Client } from '../types';
import bcrypt from 'bcrypt';

class ClientCollectionController extends Controller {

  async get(ctx: Context) {

    const user = await userService.findById(ctx.state.params.id);
    if (user.id !== ctx.state.user.id) {
      if (!await privilegeService.hasPrivilege(ctx, 'admin')) {
        throw new Forbidden('Only users with the "admin" privilege can inspect OAuth2 clients that are not your own');
      }
    }

    const clients = await findByUser(user);
    ctx.response.body = hal.collection(user, clients);

  }

  async post(ctx: Context) {

    const user = await userService.findById(ctx.state.params.id);
    if (!await privilegeService.hasPrivilege(ctx, 'admin')) {
      throw new Forbidden('Only users with the "admin" privilege can inspect OAuth2 clients that are not your own');
    }
    const allowedGrantTypes = ctx.request.body.allowedGrantTypes;
    let clientId = ctx.request.body.clientId;

    const redirectUris = ctx.request.body.redirectUris.split(' ');

    if (!clientId) {
      clientId = randomId(10);
    } else if (clientId.length < 6) {
      throw new UnprocessableEntity('clientId must be at least 6 characters or left empty');
    }

    if (!allowedGrantTypes) {
      throw new UnprocessableEntity('You must specify the allowedGrantTypes property');
    }
    const allowedGrantTypesArr:GrantType[] = allowedGrantTypes.split(' ');

    const allowedAllowedGrantTypes: GrantType[] = [
      'password',
      'client_credentials',
      'refresh_token',
      'implicit',
      'authorization_code'
    ];

    if (!allowedGrantTypesArr.every(agt => allowedAllowedGrantTypes.includes(agt))) {
      throw new UnprocessableEntity('allowedGrantTypes can only contain supported grant types as a space-delimited string. Possible supported options are: ' + allowedAllowedGrantTypes.join(' '));
    }

    const clientSecret = randomId(20);
    const newClient: Omit<OAuth2Client,'id'> = {
      clientId,
      user,
      allowedGrantTypes: allowedGrantTypesArr,
      clientSecret: await bcrypt.hash(clientSecret, 12),
    };

    const client = await create(newClient, redirectUris);
    ctx.response.body = hal.newClientSuccess(client, redirectUris, clientSecret);

  }

}

function randomId(bytes: number): string {
  const buff = crypto.randomBytes(bytes);
  return buff.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export default new ClientCollectionController();