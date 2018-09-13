// Copyright 2015-2018 Parity Technologies (UK) Ltd.
// This file is part of Parity.
//
// SPDX-License-Identifier: MIT

import * as debug from 'debug';
import { FrequencyObservable, FrequencyObservableMetadata } from '../../types';
import { Observable, Observer, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { createApiFromProvider, getApi } from '../../api';
import { distinctReplayRefCount } from '../../utils/operators/distinctReplayRefCount';

/**
 * Observable that emits on each pubsub event.
 *
 * @ignore
 * @example onAccountsChanged$, onEveryBlock$...
 */
const createPubsubObservable = <T>(
  pubsub: string,
  provider?: any // TODO @parity/api
) => {
  const [namespace, method] = pubsub.split('_');
  const api = provider ? createApiFromProvider(provider) : getApi();

  // There's a chance the provider doesn't support pubsub, for example
  // MetaMaskProvider. In this case, as suggested on their Github, the best
  // solution for now is to poll.
  if (!api.isPubSub) {
    debug('@parity/light.js:api')(
      `Pubsub not available for ${
        api.provider ? api.provider.constructor.name : 'current Api'
      } provider, polling "${pubsub}" every second.`
    );

    return timer(0, 1000).pipe(
      switchMap(() => api[namespace][method]())
    ) as Observable<T>;
  }

  return Observable.create((observer: Observer<T>) => {
    const subscription = api.pubsub[namespace][method](
      (error: Error, result: any) => {
        // TODO use @parity/api type for result
        if (error) {
          observer.error(error);
        } else {
          observer.next(result);
        }
      }
    );
    return () =>
      subscription.then((subscriptionId: string) =>
        api.pubsub.unsubscribe(subscriptionId)
      );
  }).pipe(distinctReplayRefCount()) as Observable<T>;
};

export default createPubsubObservable;
