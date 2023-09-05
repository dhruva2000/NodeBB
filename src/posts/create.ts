import _ from 'lodash';
import categories from '../categories';
import db from '../database';
import groups from '../groups';
import meta from '../meta';
import plugins from '../plugins';
import topics from '../topics';
import user from '../user';
import utils from '../utils';

import { TopicObject } from '../types';

export = function (Posts) {
    interface CustomData {
      content: string;
      timestamp: number;
      isMain: boolean;
      uid: string;
      tid: number;
      toPid: unknown;
      ip?: number;
      handle?: boolean;
    }
    interface PostData {
        pid: number;
        uid: string;
        tid: number;
        cid: number;
        content: string;
        timestamp: number;
        isMain: boolean;
        toPid: number;
        ip: number;
        handle: boolean;
    }

    async function addReplyTo(postData:PostData, timestamp:number) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!postData.toPid) {
            return;
        }
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-template-expressions
            db.sortedSetAdd(`pid:${postData.toPid}:replies`, timestamp, postData.pid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-template-expressions
            db.incrObjectField(`post:${postData.toPid}`, 'replies'),
        ]);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Posts.create = async function (data: CustomData) {
    // This is an internal method, consider using Topics.reply instead
        const { uid } = data;
        const { tid } = data;
        const content:string = data.content.toString();
        const timestamp:number = data.timestamp || Date.now();
        const isMain = data.isMain || false;

        if (!uid && parseInt(uid, 10) !== 0) {
            throw new Error('[[error:invalid-uid]]');
        }

        if (data.toPid && !utils.isNumber(data.toPid)) {
            throw new Error('[[error:invalid-pid]]');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const pid:number = await db.incrObjectField('global', 'nextPid') as number;

        let postData = {
            pid: pid,
            uid: uid,
            tid: tid,
            cid: null,
            content: content,
            timestamp: timestamp,
            toPid: null,
            handle: null,
            ip: null,
            isMain: null,
        };

        if (data.toPid) {
            postData.toPid = data.toPid;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (data.ip && meta.config.trackIpPerPost) {
            postData.ip = data.ip;
        }
        if (data.handle && !parseInt(uid as unknown as string, 10)) {
            postData.handle = data.handle;
        }

        type ResultData = {
            post: PostData;
            data: CustomData;
        }

        let result = await plugins.hooks.fire('filter:post.create', { post: postData, data: data }) as ResultData;
        postData = result.post;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`post:${postData.pid}`, postData);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const topicData:TopicObject = await topics.getTopicFields(tid, ['cid', 'pinned']) as TopicObject;
        postData.cid = topicData.cid;

        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetAdd('posts:pid', timestamp, postData.pid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectField('global', 'postCount'),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.onNewPostMade(postData),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topics.onNewPostMade(postData),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            categories.onNewPostMade(topicData.cid, topicData.pinned, postData),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groups.onNewPostMade(postData),
            addReplyTo(postData, timestamp),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Posts.uploads.sync(postData.pid),
        ]);
        try {
            result = await plugins.hooks.fire('filter:post.get', { post: postData, uid: data.uid }) as ResultData;
            result.post.isMain = isMain;
            await plugins.hooks.fire('action:post.save', { post: _.clone(result.post) });
            return result.post;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };
};






